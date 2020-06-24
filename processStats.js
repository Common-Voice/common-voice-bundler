const updateClipStats = (stats, row) => {
  const localeStats =
    stats[row.locale] ||
    (stats[row.locale] = {
      clips: 0,
      splits: { accent: {}, age: {}, gender: {} },
      usersSet: new Set(),
    });

  localeStats.clips++;
  localeStats.usersSet.add(row.client_id);

  const { splits } = localeStats;

  for (const key of Object.keys(splits).filter(key => key != 'filter')) {
    const value = row[key] ? row[key] : '';
    splits[key][value] = (splits[key][value] || 0) + 1;
  }

  stats[row.locale] = localeStats;

  return stats;
};

const formatFinalClipsStats = localeSplits => {
  return (processedStats = objectMap(
    localeSplits,
    ({ clips, splits, usersSet }) => ({
      clips,
      splits: objectMap(splits, (values, key) => {
        const label = key ? key : '';
        return {
          [label]: objectMap(values, value =>
            Number((value / clips).toFixed(2))
          ),
        };
      }),
      users: usersSet.size,
    })
  ));
};

const calculateAggregateStats = (stats, releaseLocales) => {
  let totalDuration = 0;
  let totalValidDurationSecs = 0;

  for (const locale of releaseLocales) {
    const localeStats = stats.locales[locale];
    const validClips = localeStats.buckets ? localeStats.buckets.validated : 0;

    localeStats.avgDurationSecs =
      Math.round(localeStats.duration / localeStats.clips) / 1000;
    localeStats.validDurationSecs =
      Math.round((localeStats.duration / localeStats.clips) * validClips) /
      1000;

    localeStats.totalHrs = unitToHours(localeStats.duration, 'ms', 2);
    localeStats.validHrs = unitToHours(localeStats.validDurationSecs, 's', 2);

    stats.locales[locale] = localeStats;

    totalDuration += localeStats.duration;
    totalValidDurationSecs += localeStats.validDurationSecs;
  }

  stats.totalDuration = Math.floor(totalDuration);
  stats.totalValidDurationSecs = Math.floor(totalValidDurationSecs);
  stats.totalHrs = unitToHours(stats.totalDuration, 'ms', 0);
  stats.totalValidHrs = unitToHours(stats.totalValidDurationSecs, 's', 0);

  return stats;
};

const collectAndUploadStats = async (
  stats,
  releaseLocales,
  bundlerBucket,
  releaseName
) => {
  let statsJson;
  const locales = merge(...stats);

  if (config.get('singleBundle')) {
    statsJSON = calculateAggregateStats(
      {
        bundleURL: `https://${bundlerBucket.name}.s3.amazonaws.com/${releaseName}/${releaseName}.tar.gz`,
        locales: { ...locales, [releaseName]: null },
        overall: locales[releaseName],
      },
      releaseLocales
    );
  } else {
    statsJSON = calculateAggregateStats(
      {
        bundleURLTemplate: `https://${bundlerBucket.name}.s3.amazonaws.com/${releaseName}/{locale}.tar.gz`,
        locales,
      },
      releaseLocales
    );
  }

  saveStatsToDisk(statsJson);

  return bundlerBucket.bucket
    .putObject({
      Body: JSON.stringify(statsJson),
      Bucket: bundlerBucket.name,
      Key: `${releaseName}/stats.json`,
      ACL: 'public-read',
    })
    .promise();
};

const saveStatsToDisk = (releaseName, stats) => {
  fs.writeFile(
    `${releaseName}/stats.json`,
    JSON.stringify(stats),
    'utf8',
    err => {
      if (err) throw err;
    }
  );
};

module.exports = {
  updateClipStats,
  formatFinalClipsStats,
  calculateAggregateStats,
  collectAndUploadStats,
  saveStatsToDisk,
};

const S3 = require('aws-sdk/clients/s3');
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const { PassThrough } = require('stream');
const config = require('./config');
const { logProgress } = require('./helpers');

const { accessKeyId, secretAccessKey, name: outBucketName } = config.get(
  'outBucket',
);

const outBucket = new S3({
  ...(accessKeyId
    ? {
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }
    : {}),
  region: 'us-west-2',
});

const releaseDir = config.get('releaseName');

const tarAndUpload = (locale) => new Promise((resolve) => {
  const stream = new PassThrough();
  const archiveName = `${releaseDir}/${locale}.tar.gz`;
  console.log('archiving & uploading', archiveName);
  const managedUpload = outBucket.upload({
    Body: stream,
    Bucket: outBucketName,
    Key: archiveName,
    ACL: 'public-read',
  });

  logProgress(managedUpload);

  const localeDir = path.join(releaseDir, locale);
  tar
    .c({ gzip: true, cwd: localeDir }, fs.readdirSync(localeDir))
    .pipe(stream);

  return managedUpload
    .promise()
    .then(() => outBucket
      .headObject({ Bucket: outBucketName, Key: archiveName })
      .promise()
      .then(() => resolve()))
    .catch((err) => console.error(err));
});

try {
  if (process.argv.length !== 3) throw new Error('Please enter a locale parameter');

  const [locale] = process.argv.slice(2);

  tarAndUpload(locale)
    .catch((e) => console.error(e))
    .finally(() => process.exit(0));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

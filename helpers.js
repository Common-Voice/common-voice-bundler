const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const config = require('./config');

function bytesToSize(bytes) {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes == 0) return '0 Byte';
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

function hash(row) {
  return crypto
    .pbkdf2Sync(row, config.get('salt'), 1000, 64, 'sha512')
    .toString('hex');
}

function logProgress(managedUpload) {
  managedUpload.on('httpUploadProgress', progress => {
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(bytesToSize(progress.loaded) + ' upload progress');
  });
}

function mkDirByPathSync(targetDir) {
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : '';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve('.', parentDir, childDir);
    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') {
        // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === 'ENOENT') {
        // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || (caughtErr && curDir === path.resolve(targetDir))) {
        throw err; // Throw if it's just the last created dir.
      }
    }

    return curDir;
  }, initDir);
}

module.exports = { hash, logProgress, mkDirByPathSync };

// plugins/withCustomerDisplay.js
//
// Expo config plugin: on every `expo prebuild` (local or EAS cloud),
// copies the native Sunmi customer-display Kotlin files into the
// generated android/ project and registers the package in
// MainApplication.kt. Keeps the app fully "managed" -- no need to
// keep android/ checked into git or hand-edit it after every prebuild.

const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = 'com/foodup/posup'; // must match your app.json android.package, dots -> slashes

const NATIVE_FILES = [
  'CustomerDisplayPresentation.kt',
  'CustomerDisplayModule.kt',
  'CustomerDisplayPackage.kt',
];

function withCustomerDisplayFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const srcDir = path.join(config.modRequest.projectRoot, 'plugins', 'android');
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', ...PACKAGE_PATH.split('/')
      );

      fs.mkdirSync(destDir, { recursive: true });

      for (const file of NATIVE_FILES) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }

      return config;
    },
  ]);
}

function withCustomerDisplayRegistration(config) {
  return withMainApplication(config, (config) => {
    const contents = config.modResults.contents;

    if (!contents.includes('CustomerDisplayPackage()')) {
      config.modResults.contents = contents.replace(
        /(add\(PackageList\(this\)\.packages\(\)\))/,
        `$1\n              add(CustomerDisplayPackage())`
      );
    }

    return config;
  });
}

module.exports = function withCustomerDisplay(config) {
  config = withCustomerDisplayFiles(config);
  config = withCustomerDisplayRegistration(config);
  return config;
};
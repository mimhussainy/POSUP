const { withDangerousMod, withMainApplication, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = 'com/foodup/posup';
const AIDL_PACKAGE_PATH = 'woyou/aidlservice/jiuiv5';

function withSunmiFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const srcDir = path.join(config.modRequest.projectRoot, 'plugins', 'android');
      const javaDestDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', ...PACKAGE_PATH.split('/')
      );
      const aidlDestDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'aidl', ...AIDL_PACKAGE_PATH.split('/')
      );
      const aidlSrcDir = path.join(srcDir, 'aidl', ...AIDL_PACKAGE_PATH.split('/'));

      fs.mkdirSync(javaDestDir, { recursive: true });
      fs.mkdirSync(aidlDestDir, { recursive: true });

      fs.copyFileSync(path.join(srcDir, 'SunmiPrinterModule.kt'), path.join(javaDestDir, 'SunmiPrinterModule.kt'));
      fs.copyFileSync(path.join(srcDir, 'SunmiPrinterPackage.kt'), path.join(javaDestDir, 'SunmiPrinterPackage.kt'));

      fs.copyFileSync(path.join(aidlSrcDir, 'ICallback.aidl'), path.join(aidlDestDir, 'ICallback.aidl'));
      fs.copyFileSync(path.join(aidlSrcDir, 'IWoyouService.aidl'), path.join(aidlDestDir, 'IWoyouService.aidl'));

      return config;
    },
  ]);
}

function withAidlBuildFeature(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (!contents.includes('aidl = true') && !contents.includes('aidl true')) {
      config.modResults.contents = contents.replace(
        /(android\s*\{)/,
        `$1\n    buildFeatures {\n        aidl = true\n    }`
      );
    }

    return config;
  });
}

function withSunmiRegistration(config) {
  return withMainApplication(config, (config) => {
    const contents = config.modResults.contents;

    if (!contents.includes('SunmiPrinterPackage()')) {
      config.modResults.contents = contents.replace(
        /(add\(PackageList\(this\)\.packages\(\)\))/,
        `$1\n              add(SunmiPrinterPackage())`
      );
    }

    return config;
  });
}

module.exports = function withSunmiPrinter(config) {
  config = withSunmiFiles(config);
  config = withAidlBuildFeature(config);
  config = withSunmiRegistration(config);
  return config;
};
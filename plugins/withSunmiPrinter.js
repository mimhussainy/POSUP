const { withDangerousMod, withMainApplication, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = 'com/foodup/posup';

function withSunmiFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const srcDir = path.join(config.modRequest.projectRoot, 'plugins', 'android');
      const javaDestDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java', ...PACKAGE_PATH.split('/')
      );

      fs.mkdirSync(javaDestDir, { recursive: true });

      fs.copyFileSync(path.join(srcDir, 'SunmiPrinterModule.kt'), path.join(javaDestDir, 'SunmiPrinterModule.kt'));
      fs.copyFileSync(path.join(srcDir, 'SunmiPrinterPackage.kt'), path.join(javaDestDir, 'SunmiPrinterPackage.kt'));

      return config;
    },
  ]);
}

function withPrinterXDependency(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (!contents.includes('com.sunmi:printerx')) {
      config.modResults.contents = contents.replace(
        /(dependencies\s*\{)/,
        `$1\n    implementation 'com.sunmi:printerx:1.0.20'`
      );
    }

    return config;
  });
}

function withSunmiRegistration(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('SunmiPrinterPackage()')) {
      return config;
    }

    // Expo / React Native Kotlin format:
    // PackageList(this).packages.apply {
    if (contents.includes('PackageList(this).packages.apply {')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {\n          add(SunmiPrinterPackage())`
      );

      config.modResults.contents = contents;
      return config;
    }

    // Alternative Kotlin format:
    // val packages = PackageList(this).packages
    // return packages
    if (contents.includes('return packages')) {
      contents = contents.replace(
        /return packages/,
        `packages.add(SunmiPrinterPackage())\n          return packages`
      );

      config.modResults.contents = contents;
      return config;
    }

    throw new Error(
      'Could not register SunmiPrinterPackage: unsupported MainApplication.kt format'
    );
  });
}

module.exports = function withSunmiPrinter(config) {
  config = withSunmiFiles(config);
  config = withPrinterXDependency(config);
  config = withSunmiRegistration(config);
  return config;
};
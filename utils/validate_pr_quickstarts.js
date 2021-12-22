'use strict';

const path = require('path');
const glob = require('glob');

const { fetchPaginatedGHResults } = require('./github-api-helpers');
const {
  findMainQuickstartConfigFiles,
  readYamlFile,
  removeRepoPathPrefix,
} = require('./helpers');

const GITHUB_REPO_BASE_URL =
  'https://github.com/newrelic/newrelic-quickstarts/tree/main';
const GITHUB_RAW_BASE_URL =
  'https://raw.githubusercontent.com/newrelic/newrelic-quickstarts/main';
const EXCLUDED_DIRECTORY_PATTERNS = [
  'node_modules/**',
  'utils/**',
  'docs/**',
  '*',
];
const url = process.argv[2];

const getQuickstartFilePaths = (basePath) => {
  const options = {
    ignore: EXCLUDED_DIRECTORY_PATTERNS.map((d) => path.resolve(basePath, d)),
  };

  const yamlFilePaths = [
    ...glob.sync(
      path.resolve(basePath, '../quickstarts/**/config.yaml'),
      options
    ),
    ...glob.sync(
      path.resolve(basePath, '../quickstarts/**/config.yml'),
      options
    ),
  ];

  return yamlFilePaths;
};

const hasConfig = ({ filename }) =>
  (filename.startsWith('quickstarts/') && filename.endsWith('/config.yml')) ||
  (filename.startsWith('quickstarts/') && filename.endsWith('/config.yaml'));

const getQuickstartNode = (filename, target) => {
  const splitFilePath = filename.split('/');
  return splitFilePath[splitFilePath.findIndex((path) => path === target) - 1];
};

const getQuickstartFromFilename = (filename) => {
  if (filename.includes('/alerts/')) {
    return getQuickstartNode(filename, 'alerts');
  }

  if (filename.includes('/dashboards/')) {
    return getQuickstartNode(filename, 'dashboards');
  }

  if (filename.includes('/images/')) {
    return getQuickstartNode(filename, 'images');
  }

  const targetFileName = filename.split('/').pop();

  return getQuickstartNode(filename, targetFileName);
};

const getQuickstartConfigPaths = (quickstartNames) => {
  const allQuickstartConfigPaths = findMainQuickstartConfigFiles();

  return quickstartNames.map((quickstartName) => {
    return allQuickstartConfigPaths.find((path) => {
      return path.split('/').includes(quickstartName);
    });
  });
};

const getYamlContents = (configPaths) => {
  return configPaths.map((configPath) => readYamlFile(configPath));
};

const buildMutationVariables = (quickstartConfig) => {
  const {
    authors,
    categoryTerms,
    description,
    title,
    documentation,
    logo,
    keywords,
    summary,
    installPlans,
  } = quickstartConfig.contents[0];
  const alertConfigPaths = getQuickstartAlertsConfigs(quickstartConfig.path);

  return {
    alertConditions: adaptQuickstartAlertsInput(alertConfigPaths),
    authors: authors.map((author) => {
      return { name: author };
    }),
    categoryTerms: categoryTerms || keywords,
    description: description.trim(),
    displayName: title.trim(),
    documentation: adaptQuickstartDocumentationInput(documentation),
    icon: `${GITHUB_RAW_BASE_URL}/${getQuickstartRelativePath(
      quickstartConfig.path
    )}/${logo}`,
    keywords: keywords || null,
    sourceUrl: `${GITHUB_REPO_BASE_URL}/${getQuickstartRelativePath(
      quickstartConfig.path
    )}`,
    summary: summary.trim(),
    installPlanStepIds: installPlans,
  };
};

const getQuickstartRelativePath = (configPath) => {
  const splitConfigPath = configPath.split('/');
  splitConfigPath.pop();
  return removeRepoPathPrefix(splitConfigPath.join('/'));
};

const getQuickstartAlertsConfigs = (quickstartConfigPath) => {
  const splitConfigPath = quickstartConfigPath.split('/');
  splitConfigPath.pop();
  const globPattern = `${splitConfigPath.join('/')}/alerts/*.+(yml|yaml)`;

  return glob.sync(globPattern);
};

const adaptQuickstartAlertsInput = (alertConfigPaths) => {
  if (alertConfigPaths.length == 0) {
    return null;
  }

  return alertConfigPaths.map((alertConfigPath) => {
    const parsedConfig = readQuickstartFile(alertConfigPath);
    const { details, name, type } = parsedConfig.content;
    return {
      description: details ? details.trim() : null,
      displayName: name.trim(),
      rawConfiguration: JSON.stringify(parsedConfig.content),
      type: type.trim(),
    };
  });
};

const adaptQuickstartDocumentationInput = (documentation) => {
  if (!documentation) {
    return null;
  }

  return documentation.map((doc) => {
    const { name, url, description } = doc;
    return {
      displayName: name,
      url,
      description,
    };
  });
};

const simplifyQuickstartList = (quickstartList) => {
  return [...new Set(quickstartList)];
};

const getParentQuickstart = (filename) => {
  console.log(filename);
};

Promise.resolve(fetchPaginatedGHResults(url, process.env.GITHUB_TOKEN))
  .then((response) => {
    const uniqueQuickstartConfigs = response
      .filter(hasConfig)
      .map(({ filename }) => filename);

    let uniqueQuickstarts = uniqueQuickstartConfigs.map((filename) => {
      const splitFilePath = filename.split('/');
      return splitFilePath[splitFilePath.length - 2];
    });
    response.forEach(({ filename }) => {
      uniqueQuickstarts.forEach((quickstart) => {
        console.log(`${quickstart}, ${filename}`);
        if (!filename.includes(quickstart)) {
          getParentQuickstart(filename);
        }
      });
    });
    process.exit(0);
  })
  .catch((error) => {
    throw new Error(`Github API returned ${error.message}`);
  });
// path.resolve(basePath, '../quickstarts/**/config.yml');

module.exports = {
  getQuickstartFromFilename,
  simplifyQuickstartList,
  getQuickstartConfigPaths,
  getYamlContents,
  buildMutationVariables,
};

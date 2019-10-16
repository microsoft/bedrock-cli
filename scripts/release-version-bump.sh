#!/bin/bash

set -e

RELEASE_TYPE=$1

if [[ -z "${RELEASE_TYPE}" ]]; then
  echo "Release type is not set.  Please pass in either [major, minor or patch] or any commands supported here https://yarnpkg.com/lang/en/docs/cli/version/#toc-commands"
  return 1
fi


RELEASE_BRANCH=$(whoami)/release

# get the latest from master, create a release branch
git checkout master
git pull
git checkout -b ${RELEASE_BRANCH}

# Do not tag commit
yarn config set version-git-tag false

# Commit message template
yarn config set version-git-message "release: ${RELEASE_TYPE} bump to v%s"

# Bump version following prerelease format => 1.0.0-0 becomes 1.0.0-1
yarn version "--${RELEASE_TYPE}"
git push origin ${RELEASE_BRANCH}

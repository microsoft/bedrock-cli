#!/bin/bash

set -e

REMOTE=${1:-origin}

### Tag a commit for release
git checkout master
git pull

PACKAGE_VERSION=$(node -p -e "require('./package.json').version")
echo "Version found: ${PACKAGE_VERSION}"

COMMIT=$(git rev-parse --short HEAD)
TAG="v${PACKAGE_VERSION}"
echo "Tagging commit ${COMMIT} with tag ${TAG}"

git tag ${TAG}
git push ${REMOTE} ${TAG}

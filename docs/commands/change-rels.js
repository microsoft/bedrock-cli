/* eslint-disable */
var changeTemplate =
  '<div class="change-container"><div class="change-header" id="change_rel_@@id-version@@">@@version@@</div><div class="change-content">@@changes@@</div></div>';
var commandAddedTemplate =
  '<div class="change-item-header">Commands Added</div><ul class="change-list">@@changes@@</ul>';
var commandRemovedTemplate =
  '<div class="change-item-header">Commands Removed</div><ul class="change-list">@@changes@@</ul>';
var commandValueChangedTemplate =
  '<div class="change-option-header">Command Values Changed</div><ul class="change-list">@@changes@@</ul>';
var optionAddedTemplate =
  '<div class="change-option-header">Options Added</div><ul class="change-list">@@changes@@</ul>';
var optionRemovedTemplate =
  '<div class="change-option-header">Options Removed</div><ul class="change-list">@@changes@@</ul>';
var optionChangedTemplate =
  '<div class="change-option-header">Options Changed</div><ul class="change-list">@@changes@@</ul>';

/**
 * Returns variable name associate with an argument.
 * e.g. --service-principal-id -> servicePrincipalId
 * @param arg arugment
 */
function argToVariableName(arg) {
  var match = arg.match(/\s?--([-\w]+)\s?/);
  if (match) {
    return match[1]
      .replace(/\.?(-[a-z])/g, (_, y) => {
        return y.toUpperCase();
      })
      .replace(/-/g, "");
  }
  return null;
}

/**
 * Compare two versions to figure out what new commands are added
 *
 * @param prev Previous version
 * @param cur  Current version
 */
function compareVersionDiff(prev, cur) {
  var prevKeys = Object.keys(prev);
  var results = Object.keys(cur).filter(function (k) {
    return prevKeys.indexOf(k) === -1;
  });
  return results.length > 0 ? results : undefined;
}

/**
 * Compare two set of options in the same command to figure out what new options are added.
 *
 * @param prev set of options in the same command in previous release
 * @param cur  set of options in the same command in current release
 */
function compareArgsDiff(prev, cur) {
  var prevKeys = prev.map(function (opt) {
    return opt.arg;
  });

  return cur
    .filter(function (opt) {
      return prevKeys.indexOf(opt.arg) === -1;
    })
    .map(function (opt) {
      return opt.arg;
    });
}

/**
 * Compare two set of options in the same command to figure out the changes.
 * New options added, Option removed, Option args changed.
 *
 * @param prev set of options in the same command in previous release
 * @param cur  set of options in the same command in current release
 */
function compareArgsChanged(prev, cur) {
  var optionsPrev = prev.options || [];
  var optionsCur = cur.options || [];
  var changes = {};
  var aliases = {};
  var aliasChanged = [];
  var aliasesRm = {};

  var removed = compareArgsDiff(optionsCur, optionsPrev);
  if (removed.length > 0) {
    removed.forEach(function (r) {
      var m = r.match(/^-([a-zA-Z]),\s/);
      if (m) {
        var varName = argToVariableName(r);
        aliases[varName] = m[1];
        aliasesRm[varName] = r;
      }
    });
  }

  // to figure out the change in options by comparing
  // old vs new
  var added = (compareArgsDiff(optionsPrev, optionsCur) || []).filter(function (
    add
  ) {
    var m = add.match(/^-([a-zA-Z]),\s/);
    if (m) {
      var varName = argToVariableName(add);
      if (varName in aliases) {
        var idx = removed.indexOf(aliasesRm[varName]);
        removed.splice(idx, 1);
        aliasChanged.push(
          'change "' + aliasesRm[varName] + '" to "' + add + '"'
        );
        return false;
      }
    }
    return true;
  });

  if (removed.length > 0) {
    changes.removed = removed;
  }

  if (added.length > 0) {
    changes.added = added;
  }

  if (aliasChanged.length > 0) {
    changes.changed = aliasChanged;
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Compare changes in two set of commands. one from previous
 * release and one from current release
 *
 * @param prev set of commands from previous release
 * @param cur set of commands from current release
 */
function compareVersionChanged(prev, cur) {
  var changes = {};
  var curKeys = Object.keys(cur);
  var commonKeys = Object.keys(prev).filter(function (k) {
    return curKeys.indexOf(k) !== -1;
  });

  commonKeys.forEach(function (k) {
    var newCmd = cur[k];
    var prevCmd = prev[k];
    var modified = {};

    if (newCmd.command !== prevCmd.command) {
      modified["command"] = prevCmd.command + " to " + newCmd.command;
    }

    if (newCmd.alias !== prevCmd.alias) {
      modified["alias"] = {
        prev: prevCmd.alias,
        newCmd: newCmd.alias,
      };
    }

    var optChanges = compareArgsChanged(prevCmd, newCmd);

    if (optChanges) {
      modified.options = optChanges;
    }

    if (Object.keys(modified).length > 0) {
      changes[k] = modified;
    }
  });

  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Compare two releases/versions e.g. master against 0.6.0
 *
 * @param prev previous version number e.g. 0.5.8
 * @param cur  current version number e.g. 0.5.9
 */
function compareVersion(prev, cur) {
  var prevData = dataCache[prev];
  var curData = dataCache[cur];
  var data = {};

  var added = compareVersionDiff(prevData, curData);
  if (added) {
    data.added = added;
  }

  var removed = compareVersionDiff(curData, prevData);
  if (removed) {
    data.removed = removed;
  }

  var changed = compareVersionChanged(prevData, curData);
  if (changed) {
    data.changed = changed;
  }

  return Object.keys(data).length > 0 ? data : undefined;
}

/**
 * Returns HTML for each command change
 *
 * @param oChanges changes information
 */
function getChangesHTML(oChanges) {
  changes = "";
  if (oChanges.added) {
    changes = commandAddedTemplate.replace(
      "@@changes@@",
      oChanges.added
        .map(function (add) {
          return "<li>spk " + sanitize(add) + "</li>";
        })
        .join("")
    );
  }
  if (oChanges.removed) {
    changes += commandRemovedTemplate.replace(
      "@@changes@@",
      oChanges.removed
        .map(function (rm) {
          return "<li>spk " + sanitize(rm) + "</li>";
        })
        .join("")
    );
  }
  if (oChanges.changed) {
    var optionChanges = "";
    Object.keys(oChanges.changed).forEach(function (k) {
      optionChanges +=
        '<div class="option-change"><div class="option-change-title">' +
        k +
        "</div>";

      if (oChanges.changed[k].command) {
        optionChanges += commandValueChangedTemplate.replace(
          "@@changes@@",
          sanitize(oChanges.changed[k].command)
        );
      }

      if (oChanges.changed[k].options) {
        var options = oChanges.changed[k].options;

        if (options.added) {
          optionChanges += optionAddedTemplate.replace(
            "@@changes@@",
            options.added
              .map(function (add) {
                return "<li>" + sanitize(add) + "</li>";
              })
              .join("")
          );
        }
        if (options.removed) {
          optionChanges += optionRemovedTemplate.replace(
            "@@changes@@",
            options.removed
              .map(function (rm) {
                return "<li>" + sanitize(rm) + "</li>";
              })
              .join("")
          );
        }
        if (options.changed) {
          optionChanges += optionChangedTemplate.replace(
            "@@changes@@",
            options.changed
              .map(function (chg) {
                return "<li>" + sanitize(chg) + "</li>";
              })
              .join("")
          );
        }
      }
      optionChanges += "</div>";
    });

    return (
      changes +
      '<div class="change-item-header">Commands Changed</div>' +
      optionChanges
    );
  }
}

/**
 * Insert HTML element for command changes DIV.
 */
function compareVersions() {
  var versions = Object.keys(dataCache);
  versions.sort();
  var cur = versions.shift();
  var dataChanges = {};

  versions.forEach(function (ver) {
    dataChanges[ver] = compareVersion(cur, ver);
    cur = ver;
  });
  versions.reverse();

  $("#changes").append(
    versions
      .map(function (v) {
        var oChanges = dataChanges[v];
        var changes = oChanges ? getChangesHTML(oChanges) : "no changes";
        return changeTemplate
          .replace(/@@id-version@@/g, v.replace(/\./g, "_"))
          .replace(/@@version@@/g, v)
          .replace("@@changes@@", changes);
      })
      .join("")
  );
  if (window.location.hash && window.location.hash.startsWith("#change_rel_")) {
    try {
      var oDiv = $(window.location.hash);
      if (oDiv && oDiv[0]) {
        oDiv[0].scrollIntoView();
      }
    } catch (e) {
      console.log(e);
    }
  }
  $(".change-header").click(function () {
    window.location.hash = "#" + $(this).prop("id");
  });
}

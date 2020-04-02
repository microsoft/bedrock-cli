/* eslint-disable */
var data = null;
var filter = "";
var converter = new showdown.Converter();
var releases = ["master"];
var version = "master";
var sepVersion = "@";

var template =
  '<p class="cmd-title">@@main-cmd@@</p><p class="cmd-description">@@cmd-description@@</p><p>&nbsp;</p><p>Options:</p>@@options@@<p>&nbsp;</p>';
var optionTemplate =
  '<p>@@option@@</p><p class="cmd-description">@@description@@</p>@@inherit@@<div class="line-space"></div>';
var inheritTemplate =
  '<p class="cmd-inherit">inherit @@inherit@@ from spk config.yaml</p>';
var relTemplate =
  '<li><a class="preserve-view button is-small has-border-none has-inner-focus has-flex-justify-content-start is-full-width has-text-wrap is-text-left">@@value@@</a></li>';

function sanitize(str) {
  return str.replace("<", "&lt;").replace(">", "&gt;");
}

function getExistingVersions() {
  $.ajax({
    url: "releases.txt",
    success: function (result) {
      result.split("\n").forEach(function (r) {
        var rTrim = r.trim();
        if (rTrim && releases.indexOf(rTrim) === -1) {
          releases.push(rTrim);
        }
      });
      releases.sort(function (a, b) {
        return a > b ? -1 : 1;
      });
    },
    async: false,
  });
}

function getVersion() {
  if (window.location.hash) {
    var val = window.location.hash.substring(1); // remove #
    var idx = val.indexOf(sepVersion);
    if (idx !== -1) {
      ver = val.substring(0, idx).trim();
      if (releases.indexOf(ver) !== -1) {
        version = ver;
        return;
      }
    }
  }
  version = "master";
}

function populateVersionList() {
  var oSelect = $("#ulReleases");
  oSelect.html(
    releases.reduce((a, c) => {
      return a + relTemplate.replace("@@value@@", c);
    }, "")
  );
  oSelect.find("li").each(function (i, elm) {
    $(elm).on("click", function (evt) {
      evt.stopPropagation();
      oSelect.css("display", "none");
      var ver = $(this).text();
      if (ver !== version) {
        version = ver;
        $("#selectedRelease").text(version);
        loadCommands();
      }
    });
  });
}

function showDetails(key) {
  if (!key) {
    window.location.hash = "#" + version + sepVersion;
    $("#spk-details").html("");
    return;
  }
  window.location.hash = version + sepVersion + key.replace(/\s/g, "_");
  var cmd = data[key];
  var valuesArray = cmd.command.split(/\s/);
  var values = "";
  if (valuesArray.length > 1) {
    valuesArray.shift();
    values = " " + valuesArray.join(" ");
  }
  var alias = cmd.alias ? `|${cmd.alias}` : "";
  var content = template.replace(
    "@@main-cmd@@",
    "spk " + key + alias + sanitize(values) + " [options]"
  );
  content = content.replace("@@cmd-description@@", cmd.description);

  var options = (cmd.options || []).reduce(function (a, c) {
    var o = optionTemplate
      .replace("@@option@@", sanitize(c.arg))
      .replace("@@description@@", sanitize(c.description));

    if (c.inherit) {
      o = o.replace(
        "@@inherit@@",
        inheritTemplate.replace("@@inherit@@", c.inherit)
      );
    } else {
      o = o.replace("@@inherit@@", "");
    }

    a += o;
    return a;
  }, "");
  options += optionTemplate
    .replace("@@option@@", "-h, --help")
    .replace("@@description@@", "output usage information")
    .replace("@@inherit@@", "");

  content = content.replace("@@options@@", options);

  if (cmd.markdown) {
    content =
      '<p class="cmd-title1">@@main-cmd@@</p>'.replace(
        "@@main-cmd@@",
        "spk " + key
      ) +
      '<div class="markdown">' +
      converter.makeHtml(cmd.markdown) +
      "</div><hr>" +
      content;
  }

  $("#spk-details").html(content);
}

function populateListing() {
  var cmdKeys = Object.keys(data);
  if (filter) {
    cmdKeys = cmdKeys.filter(function (k) {
      return k.indexOf(filter) !== -1;
    });
  }
  var listing = cmdKeys.reduce(function (a, c) {
    a +=
      "<li><a href=\"javascript:showDetails('" +
      c +
      "');\">spk " +
      c +
      "</a></li>";
    return a;
  }, "");

  if (listing) {
    $("#command-list").html("<ul>" + listing + "</ul>");
  } else {
    $("#command-list").html(
      '<span class="small-font">no matching commands</span>'
    );
  }
  if (window.location.hash) {
    var hashTag = window.location.hash.substring(1); // remove #
    var idx = hashTag.indexOf(sepVersion);
    if (idx !== -1) {
      hashTag = hashTag.substring(idx + 1);
    }
    var key = hashTag.replace(/_/g, " ");
    if (cmdKeys.indexOf(key) !== -1) {
      showDetails(key);
    } else {
      showDetails(cmdKeys[0]);
    }
  } else {
    showDetails(cmdKeys[0]);
  }
}

var subheaderItems = function () {
  $("#item_share").click(function (evt) {
    evt.stopPropagation();
    $("#sharing-menu").css("display", "block");
  });
  $("body").click(function () {
    $("#sharing-menu").css("display", "none");
  });
  $("#item_contribute").click(function (evt) {
    var win = window.open("https://github.com/CatalystCode/spk", "_blank");
    win.focus();
  });
};

function loadCommands() {
  var url = version === "master" ? "./data.json" : "./data" + version + ".json";
  $.getJSON(url, function (json) {
    data = json;
    subheaderItems();
    populateListing();

    $("#commandfilter").on("input", function () {
      filter = $(this).val().trim().toLowerCase();
      populateListing();
    });
  });
}

function showReleaseSelector(bShow) {
  var selector = $("#ulReleases");
  if (bShow === undefined) {
    bShow = selector.css("display") === "none";
  }
  $("#ulReleases").css("display", bShow ? "block" : "none");
  var indicator = $("#btnSelectRelease").find(".expanded-indicator");
  if (bShow) {
    indicator.removeClass("docon-chevron-down-light");
    indicator.addClass("docon-chevron-up-light");
  } else {
    indicator.removeClass("docon-chevron-up-light");
    indicator.addClass("docon-chevron-down-light");
  }
}

$(function () {
  $("#btnSelectRelease").on("click", function (evt) {
    evt.stopPropagation();
    showReleaseSelector();
  });
  $(document.body).on("click", function () {
    showReleaseSelector(false);
  });
  $(document).keyup(function (evt) {
    if (evt.keyCode === 27) {
      showReleaseSelector(false);
    }
  });
  getExistingVersions();
  getVersion();
  $("#selectedRelease").text(version);
  populateVersionList();
  loadCommands();
});

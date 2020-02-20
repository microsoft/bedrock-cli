var data = null;
var filter = "";
var converter = new showdown.Converter();

var template =
  '<p class="cmd-title">@@main-cmd@@</p><p class="cmd-description">@@cmd-description@@</p><p>&nbsp;</p><p>Options:</p>@@options@@<p>&nbsp;</p>';
var optionTemplate =
  '<p>@@option@@</p><p class="cmd-description">@@description@@</p><div class="line-space"></div>';

function sanitize(str) {
  return str.replace("<", "&lt;").replace(">", "&gt;");
}

function showDetails(key) {
  if (!key) {
    window.location.hash = "";
    $("#spk-details").html("");
    return;
  }
  window.location.hash = key.replace(/\s/g, "_");
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

  var options = cmd.options.reduce(function(a, c) {
    a += optionTemplate
      .replace("@@option@@", sanitize(c.arg))
      .replace("@@description@@", sanitize(c.description));
    return a;
  }, "");
  options += optionTemplate
    .replace("@@option@@", "-h, --help")
    .replace("@@description@@", "output usage information");

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
    cmdKeys = cmdKeys.filter(function(k) {
      return k.indexOf(filter) !== -1;
    });
  }
  var listing = cmdKeys.reduce(function(a, c) {
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
    var key = window.location.hash.replace(/_/g, " ").substring(1); // remove #
    if (cmdKeys.indexOf(key) !== -1) {
      showDetails(key);
    } else {
      showDetails(cmdKeys[0]);
    }
  } else {
    showDetails(cmdKeys[0]);
  }
}

var subheaderItems = function() {
  $("#item_share").click(function(evt) {
    evt.stopPropagation();
    $("#sharing-menu").css("display", "block");
  });
  $("body").click(function() {
    $("#sharing-menu").css("display", "none");
  });
  $("#item_contribute").click(function(evt) {
    var win = window.open("https://github.com/CatalystCode/spk", "_blank");
    win.focus();
  });
};

$(function() {
  $.getJSON("./data.json", function(json) {
    data = json;
    subheaderItems();
    populateListing();

    $("#commandfilter").on("input", function() {
      filter = $(this)
        .val()
        .trim()
        .toLowerCase();
      populateListing();
    });
  });
});

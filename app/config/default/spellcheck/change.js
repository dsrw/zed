define(function(require, exports, module) {
    var session = require("zed/session");
    return function(info, callback) {
        var path = info.path;
        var range = info.range;
        var replaceWith = info.suggestion;
        session.replaceRange(path, range, replaceWith, callback);
    };
});
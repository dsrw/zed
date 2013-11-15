/**
 * This module manages the Zed sandbox, the sandbox is used to run user
 * provided code, either fetched from the Zed code base itself, or fetched
 * from remote URLs.
 *
 * Sandboxed code cannot crash Zed itself, but can call some Zed-specific APIs.
 * These APIs live in the "zed/*" require.js namespace in the sandbox, and are
 * essentially proxies proxying the request to Zed itself via postMessage
 * communication. The APIs interfaces are defined in sandbox/interface/zed/*
 * and the Zed side is implemented in sandbox/impl/zed/*.
 */
/*global define, $, _ */
define(function(require, exports, module) {
    var command = require("./command");

    var sandboxEl;
    var id;
    var waitingForReply;

    /**
     * If we would like to reset our sandbox (e.d. to reload code), we can
     * simply delete and readd the iframe.
     */
    function resetSandbox() {
        if (sandboxEl) {
            sandboxEl.remove();
        }
        $("body").append('<iframe src="sandbox.html" id="sandbox" style="display: none;">');
        sandboxEl = $("#sandbox");
        waitingForReply = {};
        id = 0;
    }

    exports.hook = function() {
        resetSandbox();
    };

    /**
     * Handle a request coming from within the sandbox, and send back a response
     */
    function handleApiRequest(event) {
        var data = event.data;
        require(["./sandbox/impl/" + data.module], function(mod) {
            if (!mod[data.call]) {
                return event.source.postMessage({
                    replyTo: data.id,
                    err: "No such method: " + mod
                }, "*");
            }
            mod[data.call].apply(this, data.args.concat([function(err, result) {
                event.source.postMessage({
                    replyTo: data.id,
                    err: err,
                    result: result
                }, "*");
            }]));
        });
    }

    window.addEventListener('message', function(event) {
        var data = event.data;
        var replyTo = data.replyTo;
        if (data.type === "request") {
            return handleApiRequest(event);
        }
        if (!replyTo) {
            return;
        }
        var err = data.err;
        var result = data.result;

        if (waitingForReply[replyTo]) {
            waitingForReply[replyTo](err, result);
            delete waitingForReply[replyTo];
        } else {
            console.error("Got response to unknown message id:", replyTo);
        }
    });

    /**
     * Programmatically call a sandbox command, the spec argument has the following keys:
     * - scriptUrl: the URL (http, https or relative local path) of the require.js module
     *   that implements the command
     * Any other arguments added in spec are passed along as the first argument to the
     * module which is executed as a function.
     */
    exports.execCommand = function(spec, session, callback) {
        id++;
        waitingForReply[id] = callback;
        var scriptUrl = spec.scriptUrl;
        if(scriptUrl[0] === "/") {
            scriptUrl = "configfs!" + scriptUrl;
        }
        sandboxEl[0].contentWindow.postMessage({
            url: scriptUrl,
            data: _.extend({
                path: session.filename
            }, spec),
            id: id
        }, '*');
    };

    command.define("Sandbox:Reset", {
        exec: resetSandbox,
        readOnly: true
    });
});
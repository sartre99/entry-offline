'use strict';

var parseString = require('xml2js').parseString,
    _ = require('lodash');

function processCode (xml) {
    var code = [];
    var topBlocks = xml.xml.block;
    if (topBlocks)
        code = topBlocks.map(processThread);

    var locationsX = [];
    var locationsY = [];
    code.forEach(function(thread){
        var block = thread[0];
        locationsX.push(block.x);
        locationsY.push(block.y);
    });

    var dX = 40 - Math.min.apply(null, locationsX);
    var dY = 50 - Math.min.apply(null, locationsY);

    code.forEach(function(thread){
        var block = thread[0];
        block.x += dX;
        block.y += dY;
    });

    return code;
};

function processThread (block) {
    var thread = [];
    processBlock(block, thread)
    return thread;
};

function processFunctionGeneral (block, thread) {
    var parsedBlock = block.$;

    parsedBlock.x ? parsedBlock.x = Number(parsedBlock.x) : 0;
    parsedBlock.y ? parsedBlock.y = Number(parsedBlock.y) : 0;

    var mutation = block.mutation[0];

    parsedBlock.type = "func_" + mutation.$.hashid;

    parsedBlock.params = [];
    var values = block.value;
    if (values) {
        for (var i in values) {
            var fieldBlock = values[i].block[0];
            var fieldThread = [];
            processBlock(fieldBlock, fieldThread);
            parsedBlock.params.push(fieldThread[0]);
        }
    }

    thread.push(parsedBlock);
    if (block.next)
        processBlock(block.next[0].block[0], thread);
}

function processFunctionCreate (block, thread) {
    var parsedBlock = block.$;

    parsedBlock.x ? parsedBlock.x = Number(parsedBlock.x) : 0;
    parsedBlock.y ? parsedBlock.y = Number(parsedBlock.y) : 0;

    thread.push(parsedBlock);
    if (block.next)
        processBlock(block.next[0].block[0], thread);
}

function processMutationField (block, thread) {
    var parsedBlock = block.$;

    parsedBlock.x ? parsedBlock.x = Number(parsedBlock.x) : 0;
    parsedBlock.y ? parsedBlock.y = Number(parsedBlock.y) : 0;

    switch(parsedBlock.type.substr(15, 25)) {
        case "label":
            parsedBlock.params = [block.field[0]._]
            break;
        case "string":
            var paramBlock = block.value.shift().block[0];
            parsedBlock.params = []
            processMutationParam(paramBlock, parsedBlock.params);
            break;
        case "boolean":
            var paramBlock = block.value.shift().block[0];
            parsedBlock.params = []
            processMutationParam(paramBlock, parsedBlock.params);
            break;
    }

    if (block.value && block.value.length)
        processMutationField(block.value[0].block[0], parsedBlock.params);
    thread.push(parsedBlock);
}

function processMutationParam (block, thread) {
    var parsedBlock = block.$;

    parsedBlock.x ? parsedBlock.x = Number(parsedBlock.x) : 0;
    parsedBlock.y ? parsedBlock.y = Number(parsedBlock.y) : 0;

    switch(parsedBlock.type.substr(15, 25)) {
        case "string":
            parsedBlock.type = "stringParam_" + block.mutation[0].$.hashid;
            break;
        case "boolean":
            parsedBlock.type = "booleanParam_" + block.mutation[0].$.hashid;
            break;
    }

    thread.push(parsedBlock);
}

function processBlock (block, thread) {
    if (!block) return;
    var parsedBlock = block.$;

    if (parsedBlock.type === "function_general")
        return processFunctionGeneral(block, thread);
    else if (parsedBlock.type.indexOf("function_field") == 0)
        return processMutationField(block, thread);
    else if (parsedBlock.type.indexOf("function_param") == 0)
        return processMutationParam(block, thread);

    parsedBlock.x ? parsedBlock.x = Number(parsedBlock.x) : 0;
    parsedBlock.y ? parsedBlock.y = Number(parsedBlock.y) : 0;

    var keyMap = Entry.block[parsedBlock.type].paramsKeyMap;

    var blockValues = [];
    var fields = block.field;
    if (fields) {
        fields = fields.map(function(f) {
            var val = f._;
            var pType = parsedBlock.type;
            if ((pType === "number" || pType === 'text') && val === undefined)
                val = '';
            blockValues[keyMap[f.$.name]] = val;
        });
    }

    var values = block.value;
    if (values) {
        values = values.map(function(v) {
            var fieldBlock = v.block[0];
            var fieldThread = [];
            processBlock(fieldBlock, fieldThread);
            var index = keyMap[v.$.name];
            if (blockValues.type === "rotate_by_angle_time")
                index = 0;
            blockValues[index] = fieldThread[0];
        });
    }

    if (blockValues.length) {
        parsedBlock.params = blockValues;
    }

    var statements = block.statement;
    if (statements) {
        statements = statements.map(function(s) {
            if (s.block) {
                var topBlock = s.block[0];
                return processThread(topBlock);
            } else return [];
        });
        parsedBlock.statements = statements;
    }

    if (parsedBlock.type)
        thread.push(parsedBlock);
    if (block.next)
        processBlock(block.next[0].block[0], thread);
}

module.exports = {
    convert: function(project, cb) {
        var objects = project.objects;
        var functions = project.functions;

        var done = _.after(functions.length, function() {
            done = _.after(objects.length, function() {
                cb(project);
            });

            if (!objects.length)
                done();

            for (var i = 0; i < objects.length; i++) {
                var object = objects[i];
                parseString(object.script, function(err, xml) {
                    object.script = JSON.stringify(processCode(xml));
                    done();
                });
            }
        });

        if (!functions.length)
            done();

        for (var i = 0; i < functions.length; i++) {
            var func = functions[i];
            parseString(func.content, function(err, xml) {
                func.content = JSON.stringify(processCode(xml));
                done();
            });
        }
    }
};

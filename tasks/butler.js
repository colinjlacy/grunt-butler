/*
 * grunt-butler
 * 
 *
 * Copyright (c) 2015 Colin Lacy
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('butler', 'A Grunt plugin meant to auto-generate page objects for Protractor tests, cutting down on the amount of time it takes to write end-to-end tests (ultimately encouraging more testing!)', function() {
    /**
     * Created by colinlacy on 4/10/15.
     */

    var fs = require('fs');
    var mkdirp = require('mkdirp');
    var glob = require('glob');
    var $ = require('jquery')(require("jsdom").jsdom().parentWindow);

// some configs
// todo: add to a config file
    var path = this.options.views;
    var objectsPath = this.options.destination;
    var applicationElements = ['input', 'a', 'button'];


    var Parser = function() {
      this.getFiles = function(path) {
        return glob(path);
      };

      this.getContent = function(file) {
        return fs.readFileSync(file, 'utf8');
      };

      this.ElemModel = function() {
        return {
          tagName: null,
          id: null,
          name: null,
          title: null,
          value: null,
          ngModel: null
        }
      };

      this.findElements = function(tagName, content) {
        var elemArray = [];
        var index = 0,
            stop = 0,
            start = 0;

        while(index !== -1) {
          index = content.indexOf('<' + tagName, start);
          if (index === -1) break;
          stop = content.indexOf('>', index) + 1;
          elemArray.push(content.substring(index, stop));
          start = stop;
        }
        return elemArray;
      };

      this.dash = function(string) {
        for(var char = 0; char < string.length; char++) {
          if(string.charAt(char) === string.charAt(char).toUpperCase()) {
            string = string.replace(string.charAt(char), '-' + string.charAt(char).toLowerCase());
          }
        }
        return string;
      };

      this.undash = function(string) {
        var stringArray = string.split("-");
        for (var i = 0; i < stringArray.length; i++) {
          stringArray[i] = stringArray[i].charAt(0).toUpperCase() + stringArray[i].slice(1);
        }
        return stringArray.join('');
      };

      this.buildElemObjects = function(elemString) {
        var elemModel = new this.ElemModel(),
            props = Object.keys(elemModel),
            attrs = Object.keys(new this.ElemModel()),
            length = props.length;

        for (var j = 0; j < length; j++) {
          attrs[j] = this.dash(attrs[j]);
        }

        elemModel.tagName = elemString.substring(1, elemString.indexOf(' ', 1));

        for (var i = 1; i < length; i++) { // notice I'm skipping tagName
          var index = elemString.search(attrs[i] + '=');
          if(index !== -1) {
            var limitChar = elemString[index + (attrs[i].length + 1)];
            var start = elemString.indexOf(limitChar, index) + 1;
            var stop = elemString.indexOf(limitChar, start);
            elemModel[props[i]] = elemString.substring(start, stop);
          }
        }

        return elemModel;
      };

      return this;
    };

    var Butler = function() {

      this.findByCss = function(template, label, cssString) {
        var css = template.find(cssString);
        switch (true) {
          case (css.length === 1):
            return "    this." + label + " = element(by.css('" + cssString + "'));\n";
            break;
          case (css.length > 1):
            return "    this." + label + " = element.all(by.css('" + cssString + "'));\n";
            break;
          default:
            return false;
        }
      };

      this.findByRepeater = function(template, label, searchString) {
        var string = "[ng-repeat^='" + searchString + "']";
        return (template.find(string).length > 0) ?
        "    this." + label + " = element.all(by.repeater('" + searchString + "'));\n" :
            false;
      };

      this.findByModel = function(template, label, searchString) {
        var string = "[ng-model='" + searchString + "']";
        return (template.find(string).length > 0) ?
        "    this." + label + " = element.all(by.repeater('" + searchString + "'));\n" :
            false;
      };

      this.butle = function(content) {
        var cssKeys = Object.keys(this.options.css);
        var repeaterKeys = Object.keys(this.options.repeater);
        var modelKeys = Object.keys(this.options.model);
        var butlerStrings = [];

        for(var i = 0; i < cssKeys.length; i++) {
          var $tempBody = $("body").clone().append(content);
          var elem = this.findByCss($tempBody, cssKeys[i], config.css[cssKeys[i]], config.css[cssKeys[i]]);
          if (elem) butlerStrings.push(elem);
        }

        for(i = 0; i < repeaterKeys.length; i++) {
          var $tempBody = $("body").clone().append(content);
          var elem = this.findByRepeater($tempBody, repeaterKeys[i], config.repeater[repeaterKeys[i]]);
          if (elem) butlerStrings.push(elem);
        }

        for(i = 0; i < modelKeys.length; i++) {
          var $tempBody = $("body").clone().append(content);
          var elem = this.findByModel($tempBody, modelKeys[i], config.model[modelKeys[i]]);
          if (elem) butlerStrings.push(elem);
        }


        return butlerStrings;
      }
    };

    var Reader = function() {
      this.fileArray = parser.getFiles(path);

      this.findElementStrings = function(content) {
        var totalElems = [];
        for (var i = 0; i < applicationElements.length; i++) {
          totalElems = totalElems.concat(parser.findElements(applicationElements[i], content));
        }
        return totalElems;
      };

      this.buildElemObjectsFromStrings = function(totalElems) {
        var elemObjectsArray = [];
        for (var i = 0; i < totalElems.length; i++) {
          var returnedElemObjects = parser.buildElemObjects(totalElems[i]);
          elemObjectsArray.push(returnedElemObjects);
        }
        return elemObjectsArray;
      };

      this.buildFileObjects = function() {
        var fileObjects = [];

        for (var i = 0; i < this.fileArray.length; i++) {
          var obj = {};

          obj.filename = this.fileArray[i];
          obj.content = parser.getContent(path + '/' + this.fileArray[i]);
          obj.elems = this.findElementStrings(obj.content);
          obj.elemObjects = this.buildElemObjectsFromStrings(obj.elems);
          obj.butlerStrings = butler.butle(obj.content);

          fileObjects.push(obj);
        }
        return fileObjects;
      };

      return this;

    };

    var Writer = function() {
      this.findLabel = function(elemObj) {
        var keys = Object.keys(elemObj);
        for (var i = 1; i < keys.length; i++) {
          if (elemObj[keys[i]]) return {prop: keys[i], value: elemObj[keys[i]]};
        }
      };

      this.prepObj = function(elemObj) {
        elemObj.label = this.findLabel(elemObj);
        if (!elemObj.label) return null; // means there was a problem in the builder logic - i.e. no usable attr.
        if (elemObj.tagName === 'a') {
          // aking page objects less literal, more human-readable
          elemObj.tagName = 'link';
        }
        elemObj.propName = elemObj.tagName + parser.undash(elemObj.label.value);
        return elemObj;
      };

      this.locatorString = function(elemObj) {
        return "    this." + elemObj.propName + " = element(by." + elemObj.label.prop + "('" + elemObj.label.value + "'));";
      };

      this.sendKeysString = function(elemObj) {
        return "    this.enter" + parser.undash(elemObj.label.value) + " = function(string) { this." + elemObj.propName + ".sendKeys(string) };";
      };

      this.clickElem = function(elemObj) {
        return "    this.click" + parser.undash(elemObj.label.value) + " = function() { this." + elemObj.propName + ".click.() };";
      };

      this.reviseFilename = function(filename) {
        return filename.substr(0, filename.search('.html'));
      };

      this.writePageObjectFiles = function() {
        mkdirp(objectsPath);

        var views = reader.buildFileObjects();

        for (var i = 0; i < views.length; i++) {

          var view = views[i],
              filename = this.reviseFilename(view.filename) + 'View.js',
              moduleName = this.reviseFilename(view.filename).charAt(0).toUpperCase() + this.reviseFilename(view.filename).slice(1) + 'View',
              content = "var " + moduleName + " = function() {\n\n";
          for (var j = 0; j < view.elemObjects.length; j++) {
            view.elemObjects[j] = this.prepObj(view.elemObjects[j]);
            if(view.elemObjects[j]) {
              content += this.locatorString(view.elemObjects[j]) + "\n";
              if (view.elemObjects[j].tagName === 'input') {
                content += this.sendKeysString(view.elemObjects[j]) + "\n";
              }
              if (view.elemObjects[j].tagName === 'link' || view.elemObjects[j].tagName === 'button') {
                content += this.clickElem(view.elemObjects[j]) + "\n";
              }
            }
          }

          for(var k = 0; k < view.butlerStrings.length; k++) {
            content += view.butlerStrings[k];
          }

          content += "\n};\n" +
          "\n" +
          "module.exports = new " + moduleName + "();";

          fs.writeFileSync(objectsPath + '/' + filename, content);
        }
      };

      return this;
    };

    var parser = new Parser(),
        butler = new Butler(),
        reader = new Reader(),
        writer = new Writer();

    writer.writePageObjectFiles();
  });
};

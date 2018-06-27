const Q     = require('q');
const util  = require('util');
const debug = require('debug');
const _     = require('lodash');

const FN_ARGS        = /function\s*[^\(]*\(\s*([^\)]*)\)/m;
const FN_ARG_SPLIT   = /,/;
const FN_ARG         = /^\s*(_?)(\S+?)\1\s*$/;
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

module.exports = OpSet;
function OpSet(alias, Structure) {
  this.setStructure(Structure);
  this.alias = alias || module.filename;
  this.debug = debug('OpSet:' + this.alias);
}

OpSet.prototype.setStructure = function(StructureToExtend) {
  this.Structure = function Structure() {};
  if (StructureToExtend) {
    this.Structure = function Structure() {
      StructureToExtend.apply(this);
    };
    util.inherits(this.Structure, StructureToExtend);
  }
  this.cache = new this.Structure();
};

OpSet.prototype.getStructure = function() {
  return this.Structure;
};

OpSet.prototype.detectDependencies = function(fn) {
  let dependencies = [];
  let fnText = fn.toString().replace(STRIP_COMMENTS, '');
  let argDecl = fnText.match(FN_ARGS);
  _.forEach(argDecl[1].split(FN_ARG_SPLIT), function(arg) {
    arg.replace(FN_ARG, function(all, underscore, name) {
      dependencies.push(name);
    });
  });
  return dependencies;
};

OpSet.prototype.set = function() { // just an alias
  return this.setCache.apply(this, arguments);
};

OpSet.prototype.setCache = function(alias, value) {
  this.debug('Caching "%s"', alias);
  this.cache[alias] = value;
  return this;
};

OpSet.prototype.getCache = function(alias) {
  this.debug('Resolving "%s" from cache', alias);
  return this.cache && this.cache[alias];
};

OpSet.prototype.getOperation = function(alias) {
  this.debug('Resolving "%s" from structure', alias);
  return this.Structure.prototype[alias];
};

OpSet.prototype.op = function() { // just an alias
  return this.operation.apply(this, arguments);
};

OpSet.prototype.operation = function(alias, fn) {
  this.debug('Defining operation "%s"', alias);
  fn.dependencies = this.detectDependencies(fn);
  this.Structure.prototype[alias] = fn;
  return this;
};

OpSet.prototype.value = function(alias, value) {
  this.debug('Defining value "%s"', alias);
  this.Structure.prototype[alias] = value;
  return this;
};

OpSet.prototype.getFunctionSignature = function(fn) {
  let fnText = fn.toString().replace(STRIP_COMMENTS, '');
  let args = fnText.match(FN_ARGS);
  if (args) {
    return 'function(' + (args[1] || '').replace(/[\s\r\n]+/, ' ') + ')';
  }
  return 'fn';
};

OpSet.prototype.run = function(fn, path) {
  path = path && path.slice() || [this.alias];
  let deferred = Q.defer();
  const isString   = _.isString(fn);
  const isFunction = _.isFunction(fn);
  let alias = isString ? fn : this.getFunctionSignature(fn);
  const isCircular = isString && ~path.indexOf(alias);
  const isCached = isString && this.cache.hasOwnProperty(alias);
  path.push(alias);
  const PATH = path.join(' -> ');
  const reject = function(msg) {
    deferred.reject(new Error(msg));
    return deferred.promise;
  };
  if (isCircular) {
    return reject('Circular dependency found: ' + PATH);
  }
  if (!isString && !isFunction) {
    return reject('Cannot run operation: ' + PATH);
  }
  this.debug('Resolving %s', PATH);
  if (isFunction) {
    fn.dependencies = this.detectDependencies(fn);
  }
  if (isString) {
    if (isCached) {
      deferred.resolve(this.getCache(alias));
      return deferred.promise;
    }
    if (_.isUndefined(this.Structure.prototype[alias])) {
      return reject('No provider found for ' + PATH);
    }
    fn = this.getOperation(alias);
  }
  let runner = this.run.bind(this);
  let dependenciesPromises = fn.dependencies.map(function(dep) {
    return Q.fcall(runner, dep, path);
  });
  let resolvedDependencies = Q.all(dependenciesPromises);
  let result = Q.spread(resolvedDependencies, fn.bind(this.cache));
  this.setCache(alias, result);
  deferred.resolve(result);
  const self = this;
  deferred.promise.then(function() {
    self.debug('"%s" OK', PATH);
  });
  deferred.promise.fail(function(err) {
    self.debug('"%s" ERROR', PATH, err.stack);
  });
  return deferred.promise;
};

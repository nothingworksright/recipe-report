#!/usr/bin/env node

/**
 * The application end points (routes) for the Grocereport API server.
 * @namespace routes
 * @public
 * @author jmg1138 {@link https://github.com/jmg1138 jmg1138 on GitHub}
 */

/**
 * Invoke strict mode for the entire script.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode Strict mode}
 */
"use strict";

/**
 * Require the modules that will be used.
 * @see {@link https://github.com/auth0/node-jsonwebtoken node-jsonwebtoken}
 * @see {@link https://github.com/jaredhanson/passport-local passport-local}
 * @see {@link https://github.com/jaredhanson/passport Passport}
 * @see {@link https://github.com/themikenicholson/passport-jwt passport-jwt}
 * @see {@link https://github.com/guileen/node-sendmail node-sendmail}
 */
var jwt = require("jsonwebtoken");
var LocalStrategy = require("passport-local").Strategy;
var passport = require("passport");
var passportJWT = require("passport-jwt");
var sendmail = require("sendmail")({
  silent: true // No console output
});

/**
 * Require the local modules that will be used.
 * @var {object} account The MongoDB account model
 */
var account = require("../models/account");
var emailing = require("../util/email");
var accounting = require("../util/account");
var jwting = require("../util/jwt");
var respond = require("../util/respond");

/**
 * Setup passport-jwt.
 * Look in the authorization header to extract the JWT from the request.
 * Use string "testSecret" if environmental variable JWT_SECRET is not defined.
 * Use algorithm HS256 if environmental variable JWT_ALGORITHM is not defined.
 */
var JwtStrategy = passportJWT.Strategy;
var ExtractJwt = passportJWT.ExtractJwt;
var jwtOptions = {};
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeader();
jwtOptions.secretOrKey = process.env.JWT_SECRET || "testSecret";
jwtOptions.algorithm = process.env.JWT_ALGORITHM || "HS256";

/**
 * Setup Passport.
 */
passport.use(new LocalStrategy(account.authenticate()));
passport.serializeUser(account.serializeUser());
passport.deserializeUser(account.deserializeUser());
passport.use(new JwtStrategy(
  jwtOptions,
  function (payload, done) {
    account.findOne(payload._id, function (err, account) {
      if (err) {
        return done(err, false);
      }
      if (account) {
        return done(null, account);
      } else {
        return done(null, false);
      }
    });
  }));

/**
 * @public
 * @namespace router
 * @memberof routes
 * @param {object} app - The Express application instance.
 * @see {@link https://expressjs.com/en/guide/routing.html Express routing}
 * @see {@link http://expressjs.com/en/api.html Express API}
 */
var router = function (app) {

  /**
   * GET request to the root route. Responds with a JSend-compliant response.
   * @public
   * @function
   * @memberof! routes.router
   * @example
   * var request = require("request");
   * request("http://api.grocereport.com/",
   *   function(err, res, body) {
   *     if (!err && res.statusCode == 200) {
   *       console.log(body);
   *     }
   *   });
   */
  app
    .get("/", function (req, res) {
      return respond.success(res, "root", {
        "request-headers": req.headers
      });
    });

  /**
   * POST request to the register route. Responds with a JSend-compliant response. Used to register a new account document in the MongoDB instance using the email address and password provided.
   * @public
   * @function
   * @memberof! routes.router
   * @example
   * var request = require("request");
   * var options = {
   *   url: "http://api.grocereport.com/register",
   *   json: {
   *     "email": "no-reply@grocereport.com",
   *     "password": "testPassword"
   *   }
   * };
   * request.post(options, function(err, res, body) {
   *   if (!err && res.statusCode == 200) {
   *     console.log(body);
   *   }
   * });
   */
  app.post("/register", function (req, res, next) {
    var email = req.body.email;
    emailing.sanityCheck(email, function (err) {
      if (err) return respond.err(res, err);
      accounting.register(email, req.body.password, function (err, account) {
        if (err) return respond.err(res, err);
        jwting.sign(account._doc._id, function (err, token) {
          if (err) return respond.err(res, err);
          emailing.activationLink(email, token, req.headers, function (err, reply) {
            if (err) return respond.err(res, err);
            return respond.success(res, "registration");
          });
        });
      });
    });
  });

  /**
   * GET request to the activate route. Responds with a JSend-compliant response.
   * @public
   * @function
   * @memberof! routes.router
   * @example
   * var request = require("request");
   * request("http://localhost:1138/activate/secret-token",
   *   function (err, response, body) {
   *     if (!err && res.statusCode == 200) {
   *       console.log(body);
   *     }
   *   });
   */
  app.get("/activate/:token", function (req, res) {
    var token = req.params.token;
    jwting.verify(token, function (err, decoded) {
      if (err) return respond.err(res, err);
      console.dir(decoded);
    });
  });

  /**
   * POST request to the login route. Authenticates an account based on the username (email address) and password provided. Generates a token with payload containing user._doc._id. Responds with a JSend-compliant response, including the token.
   * @public
   * @function
   * @memberof! routes.router
   * @example
   * var request = require("request");
   * var options = {
   *   url: "http://api.grocereport.com/login",
   *   json: {
   *     "useremail": "no-reply@grocereport.com",
   *     "password": "testPassword"
   *   }
   * };
   * request.post(options, function(err, res, body) {
   *   if (!err && res.statusCode == 200) {
   *     console.log(body);
   *   }
   * });
   */
  app.post("/login", passport.authenticate("local"), function (req, res) {
    jwting.sign(req.user._doc._id, function (err, token) {
      if (err) return respond.err(res, err);
      return res
        .status(200)
        .json({
          "status": "success",
          "message": `User ${req.body.useremail} successfully authenticated.`,
          "data": {
            "token": token
          }
        });
    });
  });

  /**
   * All routes below will be checked for a valid authorization token. If no token is present or authentication fails, responds with a JSend-compliant response. If authorization is successful, adds decoded payload data to the request object and then calls next.
   */
  app.use(function (req, res, next) {
    var token = req.headers.authorization;
    if (token) {
      jwt
        .verify(token, jwtOptions.secretOrKey, function (err, decoded) {
          if (err) {
            return res
              .status(200)
              .json({
                "status": "error",
                "err": "Failed to authenticate token."
              });
          } else {
            req.decoded = decoded.data;
            return next();
          }
        });
    } else {
      return res
        .status(200)
        .json({
          "status": "error",
          "err": "No token provided"
        });
    }
  });

  /**
   * GET request to the test route. Responds with a JSend-compliant response
   * @public
   * @function
   * @memberof! routes.router
   * @example
   * var request = require("request");
   * var options = {
   *   url: "http://api.grocereport.com/test",
   *   headers: {
   *     "Authorization": "secret token"
   *   }
   * };
   * request(options,
   *   function(err, res, body) {
   *     if (!err && res.statusCode == 200) {
   *       console.log(body);
   *     }
   *   });
   */
  app.get("/test", function (req, res) {
    // req.decoded holds the account document ID
    return res
      .status(200)
      .json({
        "status": "success",
        "message": "Welcome to the team, DZ-015"
      });
  });

};

/**
 * Assign our appRouter object to module.exports.
 * @see {@link https://nodejs.org/api/modules.html#modules_the_module_object Nodejs modules: The module object}
 * @see {@link https://nodejs.org/api/modules.html#modules_module_exports Nodejs modules: module exports}
 */
module.exports = router;
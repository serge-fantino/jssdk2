/*! Squid Core API V2.0 */
(function (root, squid_api, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['jquery', 'backbone'], factory);
    } else {
        // Browser globals
        root[squid_api] = factory(root.$, root.Backbone);
    }
    // just make sure console.log will not crash
    if (!root.console) {
        root.console = {
            log : function() {}
        };
    }
}(this, "squid_api", function ($, Backbone) {
    
    // Squid API definition
    var squid_api = {
        version : "2.0.0",
        apiURL: null,
        loginURL : null,
        timeoutMillis : null,
        setApiURL: function(a1) {
            if (a1 && a1[a1.length - 1] == "/") {
                a1 = a1.substring(0, a1.length - 1);
            }
            this.apiURL = a1;
            console.log("apiURL : "+this.apiURL);
            return this;
        },
        setTimeoutMillis: function(t) {
            this.timeoutMillis = t;
            return this;
        },
        customerId: null,
        projectId: null,
        clientId: null,
        fakeServer: null,
        // declare some namespaces
        model: {},
        view: {},
        collection: {},
        controller: {},

        utils: {

            /*
             * Get a parameter value from the current location url
             */
            getParamValue: function(name, defaultValue) {
                var l = window.location.href;
                var idx = l.indexOf(name+"=");
                var value = "";
                if (idx>0) {
                    var i=idx+name.length+1;
                    while(i<l.length && (l.charAt(i) != "&") && (l.charAt(i) != "#")) {
                        value += l.charAt(i);
                        i++;
                    }
                } else {
                    value = defaultValue;
                }
                return value;
            },

            clearParam : function(name) {
                var l = window.location.href;
                var idx = l.indexOf(name+"=");
                var value = window.location.href;
                if (idx>0) {
                    if (l.charAt(idx-1) == "&") {
                        idx--;
                    }
                    value = l.substring(0, idx);
                    var i=idx+name.length+1;
                    while(i<l.length && (l.charAt(i) != "&") && (l.charAt(i) != "#")) {
                        i++;
                    }
                    value += l.substring(i, l.length);
                }
                return value;
            },

            /**
             * Write a cookie.
             * @param name cookie name
             * @param dom cookie domain
             * @param exp cookie expiration delay in minutes
             * @param v cookie value
             */
            writeCookie: function(name, dom, exp, v) {
                var d = null;
                if (exp) {
                    d = new Date();
                    d.setTime(d.getTime() + (exp * 60 * 1000));
                }
                var nc = name + "=" + escape(v) + ((d === null) ? "" : ";expires=" + d.toUTCString()) + "; path=/;";
                if (dom) {
                    nc = nc + " domain=" + dom;
                }
                document.cookie = nc;
            },

            readCookie: function(name) {
                var c = null,
                dc = document.cookie;
                if (dc.length > 0) {
                    var cs = dc.indexOf(name + "=");
                    if (cs != -1) {
                        cs = cs + name.length + 1;
                        var ce = dc.indexOf(";", cs);
                        if (ce == -1) {
                            ce = dc.length;
                        }
                        c = unescape(dc.substring(cs, ce));
                    }
                }
                return c;
            },

            clearLogin : function() {
                var cookiePrefix = "sq-token";
                squid_api.utils.writeCookie(cookiePrefix + "_" + squid_api.customerId, "", -100000, null);
                squid_api.utils.writeCookie(cookiePrefix, "", -100000, null);
                squid_api.model.login.set({
                    accessToken: null,
                    login: null
                });
            }
        },

        /**
         * Init the API by checking if an AccessToken is present in the url and updating the loginModel accordingly.
         * @param a loginModel (will use the default one if null)
         */
        init: function(args) {
            var me = this;
            args = args || {
                "customerId" : null,
                "clientId" : null,
                "projectId" : null,
            };
            
            this.customerId = squid_api.utils.getParamValue("customerId", null);
            if (!this.customerId) {
                this.customerId = args.customerId;
            }
            
            this.clientId = squid_api.utils.getParamValue("clientId", null);
            if (!this.clientId) {
                this.clientId = args.clientId;
            }
            
            this.projectId = squid_api.utils.getParamValue("projectId",null);
            if (!this.projectId) {
                this.projectId = args.projectId;
            }
            
            // init the api server URL
            var api = squid_api.utils.getParamValue("api","release");
            var apiUrl = squid_api.utils.getParamValue("apiUrl","https://api.squidsolutions.com");
            apiUrl += "/"+api+"/v4.2/rs";
            this.setApiURL(apiUrl);
            
            // init the Login URL
            var loginUrl = squid_api.utils.getParamValue("loginUrl","https://api.squidsolutions.com");
            loginUrl += "/api/oauth?response_type=code";
            if (this.clientId) {
                loginUrl += "&client_id=" + this.clientId;
            }
            if (this.customerId) {
                loginUrl += "&customerId=" + this.customerId;
            }
            this.loginURL = loginUrl;
            console.log("loginURL : "+this.loginURL);

            // init the timout
            var timeoutMillis = args.timeoutMillis;
            if (!timeoutMillis) {
                timeoutMillis = 10*1000; // 10 Sec.
            }
            this.setTimeoutMillis(timeoutMillis);

            var loginModel = args.loginModel;
            if (!loginModel) {
                loginModel = this.model.login;
            }
            
            // handle session expiration
            this.model.status.on('change:error', function(model) {
                var err = model.get("error").status;
                if ((err == 401) || (err == 403)) {
                    me.utils.clearLogin();
                }
            });
            
            // set the access_token (to start the login model update)      
            var code = squid_api.utils.getParamValue("code", null);
            if (code) {
                loginModel.setAccessCode(code);
            } else {
                var token = squid_api.utils.getParamValue("access_token", null);
                loginModel.setAccessToken(token);
            }
            
            // log
            console.log("squid_api.controller : "+squid_api.controller);
            console.log("squid_api.view : "+squid_api.view);
        }
    };

    squid_api.model.BaseModel = Backbone.Model.extend({
        baseRoot: function() {
            return squid_api.apiURL;
        },
        urlRoot: function() {
            return this.baseRoot();
        },
        url: function() {
            var url = this.urlRoot();
            if (typeof this.timeoutMillis === 'undefined' ) {
                url = this.addParam(url, "timeout",squid_api.timeoutMillis);
            } else {
                if (this.timeoutMillis !== null) {
                    url = this.addParam(url, "timeout",this.timeoutMillis());
                }
            }
            url = this.addParam(url, "access_token",squid_api.model.login.get("accessToken"));
            return url;
        },
        error: null,
        addParam : function(url, name, value) {
            if (value) {
                var delim;
                if (url.indexOf("?")<0) {
                    delim = "?";
                } else {
                    delim = "&";
                }
                url += delim + name + "=" + value;
            }
            return url;
        },

        optionsFilter : function(options) {
            // success
            var success;
            if (!options) {
                options = {success : null, error : null}; 
            } else {
                success = options.success;
            }
            options.success =  function(model, response, options) {
                squid_api.model.status.pullTask(model);
                // normal behavior
                if (success) {
                    success.call(this, model, response, options);
                }
            };

            var error;
            error = options.error;
            options.error =  function(model, response, options) {
                squid_api.model.status.set("error", response);
                squid_api.model.status.pullTask(model);
                if (error) {
                    // normal behavior
                    error.call(this.model, response, options);
                }
            };
            return options;
        },

        /*
         * Overriding fetch to handle token expiration
         */
        fetch : function(options) {
            squid_api.model.status.pushTask(this);
            return Backbone.Model.prototype.fetch.call(this, this.optionsFilter(options));
        },

        /*
         * Overriding save to handle token expiration
         */
        save : function(attributes, options) {
            squid_api.model.status.pushTask(this);
            return Backbone.Model.prototype.save.call(this, attributes, this.optionsFilter(options));
        }

    });

    squid_api.model.BaseCollection = Backbone.Collection.extend({
        baseRoot: function() {
            return squid_api.apiURL;
        },
        urlRoot: function() {
            return this.baseRoot();
        },
        url: function() {
            var url = this.urlRoot();
            url = this.addParam(url, "timeout",squid_api.timeoutMillis);
            url = this.addParam(url, "access_token",squid_api.model.login.get("accessToken"));
            return url;
        },
        error: null,
        addParam : function(url, name, value) {
            if (value) {
                var delim;
                if (url.indexOf("?")<0) {
                    delim = "?";
                } else {
                    delim = "&";
                }
                url += delim + name + "=" + value;
            }
            return url;
        }
    });

    squid_api.model.TokenModel = squid_api.model.BaseModel.extend({
        urlRoot: function() {
            return this.baseRoot() + "/tokeninfo";
        }
    });

    squid_api.model.LoginModel = squid_api.model.BaseModel.extend({

        accessToken: null,

        login: null,

        resetPassword: null,

        urlRoot: function() {
            return this.baseRoot() + "/user";
        },

        getDefaultLoginUrl : function() {
            var url = "https://api.squidsolutions.com/release/v4.2/api/oauth?client_id=" + squid_api.clientId;
            if (squid_api.customerId) {
                url += "&customerId=" + squid_api.customerId;
            }
            return url;
        },
        
        /**
         * Login the user using an access_token
         */
        setAccessCode: function(code, cookieExpiration) {
            var me = this;

            // set the access token and refresh data
            var request = $.ajax({
                type: "POST",
                url: squid_api.apiURL + "/token",
                dataType: 'json',
                data: {"grant_type" : "authorization_code", "code": code, "client_id" : squid_api.clientId, "redirect_uri" : null}
            });
            
            request.fail(function(jqXHR) {
                me.setAccessToken(null, cookieExpiration);
            });
            
            request.done(function(data) {
                var token = data.oid;
                me.setAccessToken(token, cookieExpiration);
            });
            
        },

        /**
         * Login the user using an access_token
         */
        setAccessToken: function(token, cookieExpiration) {
            var cookiePrefix = "sq-token",cookie, me = this;
            
            if (!cookieExpiration) {
                cookieExpiration = 120; // 2 hours
            }
            
            if (squid_api.customerId) {
                cookie = cookiePrefix + "_" + squid_api.customerId;
            }
            else {
                cookie = cookiePrefix;
            }
            if (!token) {
                // search in a cookie
                token = squid_api.utils.readCookie(cookie);
            }

            if (!token) {
                squid_api.model.login.set("login", null);
            } else {
                this.set("accessToken", token);

                // fetch the token info from server
                var tokenModel = new squid_api.model.TokenModel({
                    "token": token
                });
    
                tokenModel.fetch({
                    error: function(model, response, options) {
                        squid_api.model.login.set("login", null);
                    },
                    success: function(model, response, options) {
                        // set the customerId
                        squid_api.customerId = model.get("customerId");
                        // verify the clientId
                        if (model.get("clientId") != this.clientId) {
                            model.set("login", null);
                        }
    
                        // update login model from server
                        me.fetch({
                            success: function(model) {
                                if ((token) && (typeof token != "undefined")) {
                                    // write in a customer cookie
                                    squid_api.utils.writeCookie(cookiePrefix + "_" + squid_api.customerId, "", cookieExpiration, token);
                                    // write in a global cookie
                                    squid_api.utils.writeCookie(cookiePrefix, "", cookieExpiration, token);
                                }
                            }
                        });
                    }
                });
            }


        },

        /**
         * Logout the current user
         */
        logout: function() {
            var me = this;
            // set the access token and refresh data
            var request = $.ajax({
                type: "GET",
                url: squid_api.apiURL + "/logout?access_token=" + this.get("accessToken"),
                dataType: 'json',
                contentType: 'application/json'
            });

            request.done(function(jsonData) {
                squid_api.utils.clearLogin();
            });

            request.fail(function(jqXHR, textStatus, errorThrown) {
                squid_api.model.status.set("message", "logout failed");
                squid_api.model.status.set("error", errorThrown);
            });
        }

    });

    squid_api.model.login = new squid_api.model.LoginModel();

    // user model
    squid_api.model.UserModel = squid_api.model.BaseModel.extend({

        accessToken: null,

        login: null,

        email: null,

        groups: null,

        objectType: "User",

        password: null,

        wsName: null,

        error: "",

        url: function() {
            return this.baseRoot() + this.wsName + "?access_token=" + this.accessToken; // get user
        }

    });
    squid_api.model.userModel = new squid_api.model.UserModel();


    // Status Model
    squid_api.model.StatusModel = squid_api.model.BaseModel.extend({
        STATUS_RUNNING : "RUNNING",
        STATUS_DONE : "DONE",
        runningTasks : [],
        pushTask : function(task) {
            this.runningTasks.push(task);
            console.log("running tasks count : "+this.runningTasks.length);
            Backbone.Model.prototype.set.call(this,"status",this.STATUS_RUNNING);
        },
        pullTask : function(task) {
            var i = this.runningTasks.indexOf(task);
            if (i != -1) {
                this.runningTasks.splice(i, 1);
            }
            console.log("running tasks count : "+this.runningTasks.length);
            if (this.runningTasks.length === 0) {
                Backbone.Model.prototype.set.call(this,"status",this.STATUS_DONE);
            }
        }
    });
    squid_api.model.status = new squid_api.model.StatusModel({
        status : null,
        error : null,
        message : null
    });

    /*
     * --- Meta Model ---
     */

    squid_api.model.ProjectCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.ProjectModel,
        urlRoot: function() {
            return this.baseRoot() + "/projects";
        }
    });

    squid_api.model.ProjectModel = squid_api.model.BaseModel.extend({
        urlRoot: function() {
            return this.baseRoot() + "/projects/" + this.id.projectId;
        }
    });

    squid_api.model.DomainModel = squid_api.model.ProjectModel.extend({
        urlRoot: function() {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/domains/" + this.id.domainId;
        }
    });

    squid_api.model.MetricModel = squid_api.model.DomainModel.extend({
        urlRoot: function() {
            return squid_api.model.DomainModel.prototype.urlRoot.apply(this, arguments) + "/metrics/" + this.id.metricId;
        }
    });

    squid_api.model.MetricCollection = squid_api.model.BaseCollection.extend({
        model : squid_api.model.MetricModel
    });

    return squid_api;
}));
/*! Squid Core API AnalysisJob Controller V2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', 'squid_api'], factory);
    } else {
        factory(root.Backbone, root.squid_api);
    }
}(this, function (Backbone, squid_api) {

    var controller = {

        fakeServer: null,

        /**
         * Create (and execute) a new AnalysisJob.
         * @returns a Jquery Deferred
         */
        createAnalysisJob: function(analysisModel, filters) {
            
            var observer = $.Deferred(); 

            analysisModel.set("status","RUNNING");
    
            var selection;
            if (!filters) {
                selection =  analysisModel.get("selection");
            } else {
                selection =  filters.get("selection");
            }

            // create a new AnalysisJob
            var analysisJob = new controller.ProjectAnalysisJob();
            var projectId;
            if (analysisModel.id.projectId) {
                projectId = analysisModel.id.projectId;
            } else {
                projectId = analysisModel.get("projectId");
            }
            analysisJob.set({"id" : {
                    projectId: projectId,
                    analysisJobId: null},
                    "domains" : analysisModel.get("domains"),
                    "dimensions": analysisModel.get("dimensions"),
                    "metrics": analysisModel.get("metrics"),
                    "autoRun": analysisModel.get("autoRun"),
                    "selection": selection});

            // save the analysisJob to API
            if (this.fakeServer) {
                this.fakeServer.respond();
            }
            
            analysisJob.save({}, {
                success : function(model, response) {
                    console.log("createAnalysis success");
                    analysisModel.set("jobId", model.get("id"));
                    observer.resolve(model, response);
                },
                error : function(model, response) {
                    console.log("createAnalysis error");
                    analysisModel.set("error", response);
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                }
            });
            
            return observer;
        },
        
        /**
         * Create (and execute) a new AnalysisJob, then retrieve the results.
         */
        computeAnalysis: function(analysisModel, filters) {
            var observer = $.Deferred();
            this.createAnalysisJob(analysisModel, filters)
                .done(function(model, response) {
                    if (model.get("status") == "DONE") {
                        analysisModel.set("error", model.get("error"));
                        analysisModel.set("results", model.get("results"));
                        analysisModel.set("status", "DONE");
                        observer.resolve(model, response);
                    } else {
                        // try to get the results
                        controller.getAnalysisJobResults(observer, analysisModel);
                    }
                })
                .fail(function(model, response) {
                    observer.reject(model, response);
                });
                
            return observer;
        },
        
        /**
         * retrieve the results.
         */
        getAnalysisJobResults: function(observer, analysisModel) {
            console.log("getAnalysisJobResults");
            var analysisJobResults = new controller.ProjectAnalysisJobResult();
            analysisJobResults.set("id", analysisModel.get("jobId"));

            // get the results from API
            analysisJobResults.fetch({
                error: function(model, response) {
                    analysisModel.set("error", {message : response.statusText});
                    analysisModel.set("status", "DONE");
                    observer.reject(model, response);
                },
                success: function(model, response) {
                    if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                        // retry
                        controller.getAnalysisJobResults(observer, analysisModel);
                    } else {
                        // update the analysis Model
                        analysisModel.set("error", null);
                        analysisModel.set("results", model.toJSON());
                        analysisModel.set("status", "DONE");
                        observer.resolve(model, response);
                    }
                }
            });
            if (this.fakeServer) {
                this.fakeServer.respond();
            }
        },
        
        /**
         * Create (and execute) a new MultiAnalysisJob, retrieve the results 
         * and set the 'done' or 'error' attribute to true when all analysis are done or any failed.
         */
        computeMultiAnalysis: function(multiAnalysisModel, selection) {
            var me = this;
            multiAnalysisModel.set("status", "RUNNING");
            var analyses = multiAnalysisModel.get("analyses");
            var analysesCount = analyses.length;
            // build all jobs
            var jobs = [];
            for (var i=0; i<analysesCount; i++) {
                var analysisModel = analyses[i];
                jobs.push(this.computeAnalysis(analysisModel, selection));
            }
            console.log("analysesCount : "+analysesCount);
            // wait for jobs completion
            var combinedPromise = $.when.apply($,jobs);
            combinedPromise.done( function() {
                for (var i=0; i<analysesCount; i++) {
                    var analysis = analyses[i];
                    if (analysis.get("error")) {
                        multiAnalysisModel.set("error", analysis.get("error"));
                    }
                }
            });
            combinedPromise.always( function() {
                multiAnalysisModel.set("status", "DONE");
            });
        },

        AnalysisModel: Backbone.Model.extend({
            results: null,
            
            setProjectId : function(projectId) {
                this.set("id", {
                        "projectId": projectId,
                        "analysisJobId": null
                });
                return this;
            },
            
            setDomainIds : function(domainIdList) {
                var domains = [];
                for (var i=0; i<domainIdList.length; i++) {
                    domains.push({
                        "projectId": this.get("id").projectId,
                        "domainId": domainIdList[i]
                    });
                }
                this.set("domains", domains);
                return this;
            },
            
            setDimensionIds : function(dimensionIdList) {
                var dims = [];
                for (var i=0; i<dimensionIdList.length; i++) {
                    dims.push({
                        "projectId": this.get("id").projectId,
                        "domainId": this.get("domains")[0].domainId,
                        "dimensionId": dimensionIdList[i]
                    });
                }
                this.set("dimensions", dims);
                return this;
            },
            
            setMetricIds : function(metricIdList) {
                var metrics = [];
                for (var i=0; i<metricIdList.length; i++) {
                    metrics.push({
                        "projectId": this.get("id").projectId,
                        "domainId": this.get("domains")[0].domainId,
                        "metricId": metricIdList[i]
                    });
                }
                this.set("metrics", metrics);
                return this;
            },
            
            isDone : function() {
                return (this.get("status") == "DONE");
            }
        }),
        
        MultiAnalysisModel: Backbone.Model.extend({
            isDone : function() {
                return (this.get("status") == "DONE");
            }
        })

    };
    
    // ProjectAnalysisJob Model
    controller.ProjectAnalysisJob = squid_api.model.ProjectModel.extend({
            urlRoot: function() {
                return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/analysisjobs/" + (this.id.analysisJobId ? this.id.analysisJobId : "");
            },
            error: null,
            domains: null,
            dimensions: null,
            metrics: null,
            selection: null
        });

    // ProjectAnalysisJobResult Model
    controller.ProjectAnalysisJobResult = controller.ProjectAnalysisJob.extend({
            urlRoot: function() {
                return controller.ProjectAnalysisJob.prototype.urlRoot.apply(this, arguments) + "/results" + "?" + "compression="+this.compression+ "&"+"format="+this.format;
            },
            error: null,
            format: "json",
            compression: "none"
        });

    squid_api.controller.analysisjob = controller;
    return controller;
}));
/*! Squid Core API FacetJob Controller V2.0 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define(['Backbone', 'squid_api'], factory);
    } else {
        factory(root.Backbone, root.squid_api);
    }
}(this, function (Backbone, squid_api) {
    
    var controller = {
            
            fakeServer: null,

            /**
             * Create (and execute) a new Job.
             */
            createJob: function(jobModel, selection, successCallback) {

                jobModel.set({"userSelection" :  null}, {"silent" : true});
                jobModel.set("status","RUNNING");

                // create a new Job
                if (!selection) {
                    selection =  jobModel.get("selection");
                }

                var job = new controller.ProjectFacetJob();
                var projectId;
                if (jobModel.id.projectId) {
                    projectId = jobModel.id.projectId;
                } else {
                    projectId = jobModel.get("projectId");
                }

                job.set({"id" : {
                    projectId: projectId},
                    "domains" : jobModel.get("domains"),
                    "selection": selection});

                // save the job
                if (this.fakeServer) {
                    this.fakeServer.respond();
                }

                job.save({}, {
                    success : function(model, response) {
                        console.log("create job success");
                        if (successCallback) {
                            successCallback(model, jobModel);
                        }
                    },
                    error: function(model, response) {
                        console.log("create job error");
                        jobModel.set("error", response);
                        jobModel.set("status", "DONE");
                    }

                });

            },

            jobCreationCallback : function(model, jobModel) {
                jobModel.set("jobId", model.get("id"));
                if (model.get("status") == "DONE") {
                    jobModel.set("error", model.get("error"));
                    jobModel.set("selection", {"facets" : model.get("results").facets});
                    jobModel.set("status", "DONE");
                } else {
                    // try to get the results
                    controller.getJobResults(jobModel, filters);
                }
            },

            /**
             * Create (and execute) a new Job, then retrieve the results.
             */
            compute: function(jobModel, selection) {
                this.createJob(jobModel, selection, this.jobCreationCallback);
            },

            /**
             * retrieve the results.
             */
            getJobResults: function(jobModel) {
                console.log("get JobResults");
                var jobResults = new controller.ProjectFacetJobResult();
                jobResults.set("id", jobModel.get("jobId"));

                // get the results from API
                jobResults.fetch({
                    error: function(model, response) {
                        jobModel.set("error", {message : response.statusText});
                        jobModel.set("status", "DONE");
                    },
                    success: function(model, response) {
                        if (model.get("apiError") && (model.get("apiError") == "COMPUTING_IN_PROGRESS")) {
                            // retry
                            controller.getJobResults(jobModel);
                        } else {
                            // update the Model
                            jobModel.set("error", null);
                            jobModel.set("selection", {"facets" : model.get("facets")});
                            jobModel.set("status", "DONE");
                        }
                    }
                });
                if (this.fakeServer) {
                    this.fakeServer.respond();
                }
            },

            FiltersModel: Backbone.Model.extend({
                setProjectId : function(projectId) {
                    this.set("id", {
                        "projectId": projectId
                    });
                    return this;
                },

                setDomainIds : function(domainIdList) {
                    var domains = [];
                    for (var i=0; i<domainIdList.length; i++) {
                        domains.push({
                            "projectId": this.get("id").projectId,
                            "domainId": domainIdList[i]
                        });
                    }
                    this.set("domains", domains);
                    return this;
                },

                addSelection : function(dimension,value) {
                    var facets = this.get("selection").facets;
                    // check if the facet already exists
                    var facetToUpdate;
                    for (var i=0;i<facets.length;i++) {
                        var facet = facets[i];
                        if (facet.dimension.oid==dimension.id.dimensionId) {
                            facetToUpdate = facet;
                        }
                    }
                    if (!facetToUpdate) {
                        facetToUpdate = {
                                "dimension" : {
                                    "id" : {
                                        "projectId" : this.get("id").projectId,
                                        "domainId" : dimension.id.domainId,
                                        "dimensionId" : dimension.id.dimensionId
                                    }
                                },
                                "selectedItems" : []
                        };
                        facets.push(facetToUpdate);
                    }
                    // update the facet
                    facetToUpdate.selectedItems.push({
                        "type" : "v",
                        "id" : -1,
                        "value" : value
                    });
                },

                isDone : function() {
                    return (this.get("status") == "DONE");
                }
            })
    };

    controller.ProjectFacetJob = squid_api.model.ProjectModel.extend({
        urlRoot: function() {
            return squid_api.model.ProjectModel.prototype.urlRoot.apply(this, arguments) + "/facetjobs/" + (this.id.facetJobId ? this.id.facetJobId : "");
        },
        error: null,
        domains: null,
        timeoutMillis: function() { 
            return squid_api.timeoutMillis; 
        }
    });

    controller.ProjectFacetJobResult = controller.ProjectFacetJob.extend({
        urlRoot: function() {
            return controller.ProjectFacetJob.prototype.urlRoot.apply(this, arguments) + "/results";
        },
        error: null,
        timeoutMillis: function() { 
            return squid_api.timeoutMillis; 
        }
    });

    squid_api.controller.facetjob = controller;
    return controller;
}));
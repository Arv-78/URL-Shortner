//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const shortId = require("shortid");

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "little secrete",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(`mongodb+srv://${process.env.USERNAME}:${process.env.PASS}@cluster0.zryg6px.mongodb.net/userDB`, { useNewUrlParser: true });

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  urls: [
    {
      time: { type: Date, default: new Date() },
      full: {
        type: String,
        required: true,
      },
      short: {
        type: String,
        required: true,
        default: shortId.generate,
      },
      clicks: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  ],
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// get methods
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", function (req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          //for each url if 48 hrs then remove
          foundUser.urls.forEach((url, index, object) => {
            let time_left =
              48 - Math.floor(Math.abs(url.time - new Date()) / 3600000);
            if (time_left <= 0) {
              object.splice(index, 1);
            }
          });
          foundUser.save(function () {
            res.render("secrets", { shortUrls: foundUser.urls });
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get('/already', function(req, res){
  res.render("notValid");
})

app.get('/loginfail', function(req, res){
  res.render("notValidLogin");
})

//post methods

app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/already");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local", { failureRedirect: '/loginfail' })(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/shortUrls", async (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.urls.push({
            full: req.body.fullUrl,
          });

          foundUser.save(function () {
            res.redirect("/secrets");
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/:shortUrl", async (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          const shortUrl = foundUser.urls.find(
            (o) => o.short == req.params.shortUrl
          );
          if (shortUrl == null) return res.sendStatus(404);
          foundUser.urls.find((o) => o.short == req.params.shortUrl).clicks++;

          foundUser.save(function () {
            res.redirect(shortUrl.full);
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, () => {
  console.log("server started at port 3000");
});

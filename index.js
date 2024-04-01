import express, { response } from "express";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import session from "express-session";
import flash from "express-flash";
import passport from "passport";
import initializePassport from "./passportConfig.js"
import db from "./dbConfig.js";
import gravatar from "gravatar";

const app = express();
const port = 3000;

//All middlewares.
initializePassport(passport);
app.use(express.static("public"));
app.use('/assets', express.static('assets'));
app.use('/forms', express.static('forms'));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//Email functionality.
const my_email = process.env.MY_EMAIL;
const my_pass = process.env.MY_PASS;

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: my_email,
        pass: my_pass
    }
});
function sendMail(name, Semail, subject, message) {
    return new Promise((resolve, reject) => {
      const mailOptions = {
        from: Semail,
        to: my_email,
        subject: subject + ' Message from ' + name,
        text: message + ' from ' + Semail
      };
  
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          reject(false);
        } else {
          console.log('Email sent: ' + info.response);
          resolve(true);
        }
      });
    });
}

app.post("/contact-me", async (req, res) => {
    const name = req.body.name;
    const Semail = req.body.email;
    const subject = req.body.subject;
    const message = req.body.message;

    try {
        // Send email and get the result
        const emailSent = await sendMail(name, Semail, subject, message);
    
        // Respond to the client based on the result
        res.render("contact.ejs", {message: "Done"});
      } catch (error) {
        // Handle any unexpected errors
        console.error(error);
        res.render("contact.ejs", {message: "Not Done"});
      }  
});


//All routes.
app.get("/", async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    let author = await db.query('SELECT * FROM users WHERE id = $1', [1]);
    res.render("index.ejs", {user: req.user, posts: latestPosts.rows, author: author.rows[0]});
});

app.get('/dashboard', checkNotAuthenticated, (req, res) => {
  res.render('dashboard', {user: req.user.name});
});

app.get("/login", checkAuthenticated, async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    res.render("login.ejs", {user: req.user, posts: latestPosts.rows});
});

app.get("/register", checkAuthenticated, async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    res.render("registration.ejs", {user: req.user, posts: latestPosts.rows});
});

app.get("/contact", async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    res.render("contact.ejs", {user: req.user, posts: latestPosts.rows});
});

app.get("/about", async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    res.render("about.ejs", {user: req.user, posts: latestPosts.rows});
});

app.get("/category", async (req, res) => {
    let result = await db.query('SELECT * FROM blogposts ORDER BY id DESC');
    let author = await db.query('SELECT * FROM users WHERE id = $1', [1]);
    console.log(author);
    res.render("category.ejs", {user: req.user, posts: result.rows, posts: result.rows, author: author.rows[0]});
});


app.get("/see-post", async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    let postResult = await db.query('SELECT * FROM blogposts WHERE id = $1', [req.query.id]);
    let author = await db.query('SELECT * FROM users WHERE id = $1', [postResult.rows[0].author_id]);
    try{
        const commentsResult = await db.query('SELECT * FROM comments WHERE post_id = $1', [req.query.id]);
        res.render("single-post.ejs", {post: postResult.rows[0], comments:  commentsResult.rows, user: req.user, posts: latestPosts.rows, author: author});
    }catch(error){
        res.render("single-post.ejs", {post: postResult.rows[0], user: req.user, posts: latestPosts.rows, author: author});
    }
});

app.get("/create-post", isAdmin, async (req, res) => {
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    res.render("createBlog.ejs", {user: req.user, posts: latestPosts.rows});
});

app.get("/edit", isAdmin,  async (req, res) => {
    console.log(req.query.id);
    let latestPosts = await db.query('SELECT * FROM blogposts ORDER BY id DESC LIMIT 8;');
    let result = await db.query('SELECT * FROM blogposts WHERE id = $1', [req.query.id]);
    res.render("editBlog.ejs", {user: req.user, post: result.rows[0], posts: latestPosts.rows});
})


app.get("/delete", isAdmin, async (req, res) => {
    let result = await db.query('DELETE FROM blogposts WHERE id = $1', [req.query.id]);
    res.redirect('/');
})

//Post routes.

app.post("/register", async (req, res) => {
  let {name, email, password, password2} = req.body;
  console.log({
      name,
      email,
      password,
      password2
  })
  //Form Validation steps
  let errors = [];
  if(!name || !email || !password || !password2){
      errors.push({message:"Please fill in all fields."});
  }
  if(password !== password2){
      errors.push({message: "Passwords do not match"});
  }
  if(password.length < 6){
      errors.push( { message: "Password must be at least 6 characters long."})
  }
  //Handling validation errors.
  if(errors.length > 0){
      res.render('registration', {errors});
  }else{
      //Form validation has passed, generating a hash for the user.
      let hashedPassword;
      let gravatarUrl;
      try {
        gravatarUrl = gravatar.url(email, { s: '200', d: 'identicon', r: 'pg' });
        hashedPassword = await new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    console.log('Hashed Password: ', hash);
                    resolve(hash);
                }
            });
        });
  
        console.log("outside");
        console.log(hashedPassword);
      } catch (error) {
          // Handle errors here
          console.error(error);
          res.render('error', { message: 'Internal Server Error' });
      }
      let result = await db.query('SELECT * FROM users WHERE email = $1', [email], (err, results)=>{
          if(err){
              console.error(err);
          }else{
              console.log(results.rows);
              if(results.rows.length > 0){
                  errors.push({message:  'Email already exists.'});
                  res.render("registration", {errors})
              }else{
                  result = db.query(
                      'INSERT INTO users (name, email, password, role, grav_url) VALUES ($1, $2, $3, $4, $5) RETURNING id, password',
                      [name, email, hashedPassword, "user", gravatarUrl],
                      (err, results) => {
                          if(err){
                              throw err;
                          }
                          console.log(results.rows);
                          req.flash('success_msg','You are now registered and can log in');
                          res.redirect("/login");
                      }
                  )
              }
          }
      })
  }
})



app.post("/create-post", isAdmin,  async (req, res) => {
    const blog_authorName = req.body.author;
    const blog_title = req.body.title;
    const blog_subtitle = req.body.subtitle;
    const blog_img_url = req.body.img_url;
    const blog_content = req.body.content;
    //Date calculation.
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const yy = String(today.getFullYear()).slice(-2);
    const formattedDate = dd + '-' + mm + '-' + yy;
    let result = await db.query('INSERT INTO blogposts (author_id, title, subtitle, date, body, img_url) VALUES ($1, $2, $3, $4, $5, $6)', [1, blog_title, blog_subtitle, formattedDate, blog_content, blog_img_url]);

    res.redirect("/");
});

app.post("/login", passport.authenticate("local", {
  successRedirect:"/",
  failureRedirect:'/login',
  failureFlash: true
}));

app.post("/edit", isAdmin, async (req, res) => {
    let result = await db.query('UPDATE blogposts SET title = $1, subtitle = $2, body = $3, img_url = $4 WHERE id = $5', [req.body.title, req.body.subtitle, req.body.content, req.body.img_url, req.query.id]);
    res.redirect("/");
})

app.post("/add-comment", checkNotAuthenticated, async (req, res) => {
    //Date calculation.
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const yy = String(today.getFullYear()).slice(-2);
    const formattedDate = dd + '-' + mm + '-' + yy;
    let result = await db.query('INSERT INTO comments (content, post_id, date, name, grav_url) VALUES ($1, $2, $3, $4, $5)', [req.body.content_body, req.query.id, formattedDate, req.user.name, req.user.grav_url]);
    res.redirect('/');
})

app.get("/logout", (req, res) => {
    req.logOut((err) => {
        if(err){
            console.error(err);
            res.redirect("/");
        }
    });
    req.flash('success_msg', 'You have logged out');
    res.redirect("/");
})

function checkAuthenticated(req, res, next){
  if(req.isAuthenticated()){
      return res.redirect("/");
  }
  next();
}

function checkNotAuthenticated(req, res, next){
  if(req.isAuthenticated()){
      return next();
  }
  res.redirect("/login");
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
      return next();
    }
    res.redirect('/');
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

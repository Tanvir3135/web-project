const express = require("express");
const db = require("./db");
const path = require("path")
const session = require("express-session");
const { copyFileSync } = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (including images)
app.use('/images', express.static(path.join(__dirname, 'web/assets/images')));


// Session middleware
app.use(
  session({
    secret: "secret", // Secret used to sign the session ID cookie
    resave: false,
    saveUninitialized: true,
  })
);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Serve login page
app.get("/", (req, res) => {
  res.redirect("/home")
});

app.get("/login", (req,res) => {
  res.sendFile(__dirname + "/web/pages/login.html")
})

// Handle login form submission
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).send('Email and password are required');
  }

  
  try {
    const user = await db.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (user.rows.length > 0) {
      req.session.userEmail = email;
      req.session.loggedIn = true;
      res.redirect(`/home`)
    } else {
      res.sendStatus(401);
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.sendStatus(500);
  }
});


app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/web/pages/register.html");
});


// Handle registration form submission
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Check if name, email, and password are provided
  if (!name || !email || !password) {
    return res.status(400).send('Name, email, and password are required');
  }

  try {
    await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', [name, email, password]);
    req.session.userEmail = email;
    res.redirect('/home');
  } catch (error) {
    console.error('Error registering user:', error);
    res.sendStatus(500);
  }
});


app.get("/about", (req, res) => {
  res.sendFile(__dirname + "/web/pages/about.html");
});


app.get('/home', (req, res) => {
  res.sendFile(__dirname + '/web/pages/home.html');
});

app.get('/guides', (req, res) => {
  res.sendFile(__dirname + '/web/pages/guides.html')
})



// Serve dynamic content (blog posts) via API
// app.get('/posts', async (req, res) => {
//   try {
//     const result = await db.query('SELECT id, title, body , user_email, likes FROM posts WHERE is_deleted = false ORDER BY id DESC LIMIT 5');

//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching blog posts:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

app.get('/posts', async (req, res) => {
  try {
    // Query posts table to get the latest 5 posts
    const postsResult = await db.query('SELECT id, title, body, user_email, likes FROM posts WHERE is_deleted = false ORDER BY id DESC LIMIT 5');

    // Extract post ids from the postsResult
    const postIds = postsResult.rows.map(post => post.id);

    // Query comments table where postId matches the post ids
    const commentsResult = await db.query('SELECT post_id, comment_body FROM comments WHERE post_id = ANY($1)', [postIds]);

    // Combine posts and comments data
    const combinedData = postsResult.rows.map(post => {
      const postComments = commentsResult.rows.filter(comment => comment.post_id === post.id);
      return { ...post, comments: postComments };
    });

    // Send the combined data as JSON response
    res.json(combinedData);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to handle search
app.get('/search', async (req, res) => {
  try {
    const { query } = req.query;

    // Query posts table to get the latest 5 posts
    const postsResult = await db.query('SELECT id, title, body, user_email, likes FROM posts WHERE is_deleted = false ORDER BY id DESC LIMIT 5');

    // Extract post ids from the postsResult
    const postIds = postsResult.rows.map(post => post.id);

    // Query comments table where postId matches the post ids
    const commentsResult = await db.query('SELECT post_id, comment_body FROM comments WHERE post_id = ANY($1)', [postIds]);

    // Combine posts and comments data
    const combinedData = postsResult.rows.map(post => {
      const postComments = commentsResult.rows.filter(comment => comment.post_id === post.id);
      return { ...post, comments: postComments };
    });
    // Query posts table to get all posts
    const postsResultss = await db.query('SELECT id, title, body, user_email, likes FROM posts WHERE is_deleted = false');
    console.log(postsResultss);
    console.log(combinedData);

    // Filter posts that match the search query
    const matchedPosts = combinedData.filter(post => 
      post.title.toLowerCase().includes(query.toLowerCase()) || 
      post.body.toLowerCase().includes(query.toLowerCase())
    );

    // Sort the matched posts by relevance (you can implement your own searching algorithm here)
    matchedPosts.sort((a, b) => {
      // For example, you can sort by the number of occurrences of the query in the title and body
      const countA = (a.title.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length +
                     (a.body.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
      const countB = (b.title.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length +
                     (b.body.toLowerCase().match(new RegExp(query.toLowerCase(), 'g')) || []).length;
      return countB - countA; // Sort in descending order of relevance
    });

    // Get the top 5 matched posts
    const top5MatchedPosts = matchedPosts.slice(0, 5);

    // Send the top 5 matched posts as JSON response
    res.json(top5MatchedPosts);
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/posts', async (req, res) => {
  const { title, body, userEmail } = req.body;

  try {
    const result = await db.query('INSERT INTO posts (title, body, user_email) VALUES ($1, $2, $3) RETURNING id', [title, body, userEmail]);
    const postId = result.rows[0].id;
    res.status(200).json({ postId });
  } catch (error) {
    console.error('Error adding blog post:', error);
    res.sendStatus(500);
  }
});

app.get('/posts/:id', (req, res) => {
  const postId = req.params.id;
  db.query('SELECT * FROM posts WHERE id = $1', [postId]).then(
    result => {
      res.send(result.rows[0])
    }
  ).catch(error => console.error(error));
})

app.put('/posts/:id', (req, res) => {
  const postId = req.params.id;
  const { title, description } = req.body

  db.query('UPDATE posts set title = $1, body= $2 WHERE id = $3', [title, description, postId])
    .then(() => res.sendStatus(204))
    .catch(error => console.error(error))
})

// Route to handle adding a comment and fetching all comments for a postId
app.post('/comments/:postId', async (req, res) => {
  const { postId } = req.params;
  const { comment } = req.body;

  try {
    // Insert the comment into the database
    const insertedComment = await db.query(
      'INSERT INTO comments (post_id, comment_body) VALUES ($1, $2) RETURNING *',
      [postId, comment]
    );

    // Query all comments for the given postId
    const allComments = await db.query(
      'SELECT * FROM comments WHERE post_id = $1',
      [postId]
    );

    // Send the entire array of comments back
    res.status(201).json(allComments.rows);
  } catch (error) {
    // Send an error response if there's an issue with the database query
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'An internal server error occurred' });
  }
});

app.post('/like', async (req, res) => {
  const { userEmail, postId } = req.body;

  await db.query('UPDATE posts SET likes = likes +1 WHERE id = $1', [postId])
    .then(() => res.sendStatus(200))
    .catch(() => res.sendStatus(500))
})

app.delete('/posts/:id', async (req, res) => {
  const postId = req.params.id;
  const user_email = req.headers["user_email"]


  try {
    // Check if the current user is the author of the post
    const result = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (!result.rows.length > 0) {
      return res.status(404).send('Post not found');
    }
    const post = result.rows[0]
    if (post.user_email !== user_email) {
      return res.status(403).send('Unauthorized');
    }

    // Delete the post from the database
    await db.query('UPDATE posts SET is_deleted = true WHERE id = $1', [postId]);
    res.sendStatus(204); // No content
  } catch (error) {
    console.error('Error deleting post:', error);
    res.sendStatus(500);
  }
});

app.post("/logout", (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.sendStatus(500);
    } else {
      res.sendStatus(200)
    }
  });
});

app.get("/checkSession", (req, res) => {
  const loggedIn = req.session.loggedIn || false;
  res.status(200).send({ loggedIn });
});
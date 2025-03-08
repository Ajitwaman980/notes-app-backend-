import { Hono } from "hono";
import { logger } from "hono/logger";
import { Prisma, PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'
import bcrypt, { compareSync } from "bcryptjs";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

import {getPrisma} from "./prismaFunction"
import {sign,verify} from "hono/jwt"
import { AuthmiddleService } from "../middleware/auth";
import { Context } from "hono/jsx";



const app = new Hono<{
  Bindings: {
    DATABASE_URL: string
  
  }
  Variables: {
    userId: string
  }
}>()



// Middleware
app.use(logger());

app.post('/new/user', async (c) => {
  // Now you can use it wherever you want
  try { 
    // console.log(c.env)
    // console.log("thius is env ",c.env.DATABASE_URL)
     const prisma = getPrisma(c.env.DATABASE_URL);
     
    const {name, password,email} = await c.req.json();
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser=await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });
    console.log("this is data",newUser);
    const token=await sign({ id: newUser.id },"hsgdfhsavjgfvajvsdcajsgvdjg");
    setCookie(c, "token", token);

    return c.json({
      message: 'User created successfully',
      userId: newUser.id,
      token,
    })
    
  } catch (error) {
    // console.log(error)
   return c.json({
      message: 'An error occurred while creating the user',
      error,
    });
    
  }
})
// login 
app.post("/user/login",async (c)=>{
  try {
    const { password,email} = await c.req.json();
    const prisma = getPrisma(c.env.DATABASE_URL);
  // find 
  const user = await prisma.user.findUnique({where:{email}});
  // check if user exist and password match
   if(!user){
    return c.json({
      message: 'User not found',
    });
   }
   const passwordmatch=bcrypt.compare(user.password,password);
   if(!passwordmatch){
    return c.json({
      message: 'Invalid password',
    });
   }
  //  set cookeis 
  const token=await sign(user,"hsgdfhsavjgfvajvsdcajsgvdjg");
  setCookie(c, "token", token);

  return c.json({
    message: 'Logged in successfully',
    userId: user.id,
    token,
  });
  } catch (error) {
    return c.json({
      message: 'An error occurred while login the user',
      error,
    });
  }
})
// logout
app.get("/user/logout", (c) => {

  deleteCookie(c, "token");
  return c.json({ message: "Logged out successfully" });
})
// notes 
app.post("/notes", AuthmiddleService, async (c) => {
  try {
    const { title, content } = await c.req.json();
    if (!title || !content) {
      return c.json({ message: "Missing required fields" }, 400);
    }

    const prisma = getPrisma(c.env.DATABASE_URL);
    const userId =(c as any).get("user");

    const note = await prisma.note.create({
      data: {
        title,
        content,
        userId,
      },
    });

    return c.json({ message: "Note created successfully", note });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Error creating note", error }, 500);
  }
});

// Get All Notes for the Logged-in User
app.get("/notes", AuthmiddleService, async (c) => {
  try {
    const prisma = getPrisma(c.env.DATABASE_URL);
    const userId = (c as any).get("user");

    const notes = await prisma.note.findMany({
      where: { userId },
    });

    return c.json({ notes });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Error fetching notes", error }, 500);
  }
});

// Get a Single Note by ID
app.get("/notes/:id", AuthmiddleService, async (c) => {
  try {
    const prisma = getPrisma(c.env.DATABASE_URL);
    const userId = (c as any).get("user");
    const noteId = c.req.param("id");

    const note = await prisma.note.findUnique({
      where: { id: noteId, userId },
    });

    if (!note) {
      return c.json({ message: "Note not found" }, 404);
    }

    return c.json({ note });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Error fetching note", error }, 500);
  }
});

// Update a Note
app.put("/notes/:id", AuthmiddleService, async (c) => {
  try {
    const { title, content } = await c.req.json();
    const prisma = getPrisma(c.env.DATABASE_URL);
    const userId =(c as any).get("user");
    const noteId = c.req.param("id");

    const note = await prisma.note.updateMany({
      where: { id: noteId, userId },
      data: { title, content },
    });

    if (!note.count) {
      return c.json({ message: "Note not found or unauthorized" }, 404);
    }

    return c.json({ message: "Note updated successfully" });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Error updating note", error }, 500);
  }
});

// Delete a Note
app.delete("/notes/:id", AuthmiddleService, async (c) => {
  try {
    const prisma = getPrisma(c.env.DATABASE_URL);
    const userId =(c as any).get("user");
    const noteId = c.req.param("id");

    const note = await prisma.note.deleteMany({
      where: { id: noteId, userId },
    });

    if (!note.count) {
      return c.json({ message: "Note not found or unauthorized" }, 404);
    }

    return c.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Error deleting note", error }, 500);
  }
});
export default app;

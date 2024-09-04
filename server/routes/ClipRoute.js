const express = require("express");
const router = express.Router();
const multer = require("multer");
const { google } = require("googleapis");
const mime = require("mime-types");
const stream = require("stream");
const moment = require("moment-timezone");
const schedule = require("node-schedule");

const apikey = require("../apikey.json");

const SCOPE = ["https://www.googleapis.com/auth/drive"];

async function authorize() {
  consle.log('private', apikey.private_key) ;
  console.log('client',apikey.client_email ) ;
  const jwtClient = new google.auth.JWT(

    apikey.client_email,
    null,
    apikey.private_key,
    SCOPE
  );

  await jwtClient.authorize();

  return jwtClient;
}

async function uploadFile(authClient, name, mimeType, buffer) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    var fileMetadata = {
      name: `${Date.now()}-${name}`,
      parents: [`${process.env.DRIVE_ID  }`],
    };

    var media = {
      mimeType: mimeType,
      body: bufferToStream(buffer),
    };

    drive.files.create(
      {
        resource: fileMetadata,
        media: media,
        fields: "id",
      },
      function (err, file) {
        if (err) {
          console.error("Error uploading file:", err);
          reject(err);
        } else {
          resolve(file.data.id);
        }
      }
    );
  });
}

function bufferToStream(buffer) {
  let tmp = new stream.PassThrough();
  tmp.end(buffer);
  return tmp;
  // const readable = new stream.Readable();
  // readable._read = () => {};
  // readable.push(buffer);
  // readable.push(null);
  // return readable;
}

function currentDateTime() {
  return moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
}

async function deleteFile(authClient, fileId) {
  const drive = google.drive({ version: "v3", auth: authClient });
  await drive.files.delete({ fileId: fileId });
  // return new Promise((resolve,reject)=>{
  //     const drive = google.drive({version:'v3',auth:authClient});

  //     drive.files.delete({
  //         fileId: fileId
  //     }, function(err){
  //         if(err){
  //             console.error('Error deleting file:', err);
  //             reject(err);
  //         } else{
  //             resolve();
  //         }
  //     });
  // });
}

const Clips = require("../models/Clips");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/show", async (req, res) => {
  const { code } = req.headers;
  const clips = await Clips.findOne({ code });
  if (clips) {
    if (clips.text) {
      console.log("showing text: ", currentDateTime());
      res.status(200).json({ text: clips.text });
    } else {
      console.log("showing file: ", currentDateTime());
      res.status(200).json({ fileId: clips.file });
    }
  } else {
    console.log("NOT FOUND: ", currentDateTime());
    res.status(200).json({ text: "NOT FOUND" });
  }
});

router.post("/save", async (req, res) => {
  const { text, time } = req.body;
  let code = Math.floor(1000 + Math.random() * 9000).toString();

  let clips = await Clips.findOne({ code });

  while (clips) {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    clips = await Clips.findOne({ code });
  }

  const newClip = new Clips({ text, code });
  await newClip.save();

  console.log("Saved Text: ", currentDateTime());

  if (time === "") {
    console.log("text will be deleted after 24 hours");
    schedule.scheduleJob(moment().add(24, "hours").toDate(), async () => {
      await Clips.deleteOne({ code });

      console.log("Deleted File: ", currentDateTime());
    });
  } else {
    console.log(`text will be deleted after ${time} minutes`);
    schedule.scheduleJob(
      moment().add(parseInt(time), "minutes").toDate(),
      async () => {
        await Clips.deleteOne({ code });

        console.log("Deleted File: ", currentDateTime());
      }
    );
  }

  res.status(200).json({ message: "Saved", code: code });
});

router.post("/upload", upload.single("file"), async (req, res) => {
//  console.log('hello',req.file) ;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { time } = req.body;

    let code = Math.floor(1000 + Math.random() * 9000).toString();
    let existingClip = await Clips.findOne({ code });

    while (existingClip) {
      code = Math.floor(1000 + Math.random() * 9000).toString();
      existingClip = await Clips.findOne({ code });
    }

    const mimeType = mime.lookup(req.file.originalname);
    //console.log('hello',req.file.originalname) ;
    const auth = await authorize();
    console.log('hello',auth) ;
    const fileId = await uploadFile(
      auth,
      req.file.originalname,
      mimeType,
      req.file.buffer
    );

    const newClip = new Clips({
      file: fileId,
      code: code,
    });

    await newClip.save();

    console.log("Saved File: ", currentDateTime());

    if (time === "") {
      console.log("file will be deleted after 24 hours");
      schedule.scheduleJob(moment().add(24, "hours").toDate(), async () => {
        const auth = await authorize();
        await deleteFile(auth, fileId);
        await Clips.deleteOne({ file: fileId });

        console.log("Deleted File: ", currentDateTime());
      });
    } else {
      console.log(`file will be deleted after ${time} minutes`);
      schedule.scheduleJob(
        moment().add(parseInt(time), "minutes").toDate(),
        async () => {
          const auth = await authorize();
          await deleteFile(auth, fileId);
          await Clips.deleteOne({ file: fileId });

          console.log("Deleted File: ", currentDateTime());
        }
      );
    }

    res.status(200).json({ message: "Saved", code: code });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Error uploading file" });
  }
});

module.exports = router;

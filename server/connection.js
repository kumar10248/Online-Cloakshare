const mongoose = require('mongoose');

const url = `${process.env.MONGODB_URI}`;

mongoose.connect(url).then(()=>{console.log('Connected to database')}).catch((err)=>{console.log('Error in connecting to database',err)});
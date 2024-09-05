const mongoose = require('mongoose');

const url = `mongodb://localhost:27017/clipboard`;

mongoose.connect(url).then(()=>{console.log('Connected to database')}).catch((err)=>{console.log('Error in connecting to database',err)});
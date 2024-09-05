const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cors());

const PORT = process.env.PORT || 8000;

app.get('/',(req,res)=>{
    console.log('Ping')
    res.send('Hello World');
})

require('./connection');

const ClipRoute = require('./routes/ClipRoute');

app.use('/', ClipRoute);




app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
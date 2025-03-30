const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const bodyParser = require('body-parser');

const convertRoutes = require('./routes/convertRoutes');
const saveRoutes = require('./routes/saveRoutes');
const showRoutes = require('./routes/showRoutes');
const uploadRoutes = require('./routes/uploadRoutes');


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;

app.get('/api',(req,res)=>{
    console.log('Ping')
    res.send('Hello World');
})

require('./connection');

const ClipRoute = require('./routes/ClipRoute');
app.use('/api/save', saveRoutes);
app.use('/api/show', showRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/convert', convertRoutes);

app.use('/', ClipRoute);




app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});


import express from 'express';
import morgan from 'morgan';

const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
    let sum = 0;
    for (let i = 1; i <= 10000000; i++) {
        sum += i;
    }
    res.status(200).json({
        message: `Sum Calculated Successfully: ${sum}`
    });

});

const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


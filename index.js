import express from "express";
import * as dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;
dotenv.config();
app.use( express.json() );
app.use( cors() );

const uri = `mongodb+srv://${ process.env.MDB_USER }:${ process.env.MDB_PASSWORD }@cluster0.9wh3o6k.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient( uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
} );

const run = async () => {
    try {
        await client.connect();
        
        const database = client.db( 'timToys' );
        const productsCollection = database.collection( 'products' );

        console.log( 'hello' );
        // GET API
        // app.get( '/products', async ( req, res ) => {
        //     const cursor = productsCollection.find( {} );
        //     const products = await cursor.toArray();
        //     res.send( products );
        // } );

        // app.get( '/products/random', async ( req, res ) => {
        //     const quantity = parseInt( req.query.quantity );

        //     const cursor = productsCollection.aggregate( [
        //         { $match: { isStock: true } },
        //         { $sample: { size: quantity } },
        //         { $project: { _id: 1, title: 1, thumbnailImage: 1 } }
        //     ] );
        //     const products = await cursor.toArray();
        //     console.log( products );
        //     res.send( products );
        // } );

        // Ping your deployment
        await client.db( 'admin' ).command( { ping: 1 } );
        console.log( "Pinged your deployment. You successfully connected to MongoDB!" );
    }
    finally {
        // await client.close();
        // console.log( "Connection closed!" );
    };
};
run().catch( console.dir );

app.get( '/', ( req, res ) => {
    res.send( 'Hello from TimToys Server!' );
} );


app.listen( port, '192.168.0.179', () => {
    console.log( `TimToys Server is running on port ${ port }` );
} );

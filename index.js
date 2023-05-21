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

        // ? GET All Products
        // app.get( '/products', async ( req, res ) => {
        //     const cursor = productsCollection.find( {} );
        //     const products = await cursor.toArray();
        //     res.send( products );
        // } );

        //  ?GET random products with query: quantity and category_name(optional)
        app.get( '/products/random', async ( req, res ) => {
            const quantity = parseInt( req.query.quantity );
            const category = req.query.category;

            let pipeline = [];

            if ( category ) {
                pipeline.push( { $match: { inStock: true, category: category } } );
            } else {
                pipeline.push( { $match: { inStock: true } } );
            }

            pipeline.push(
                { $sample: { size: quantity } },
                { $project: { _id: 1, title: 1, thumbnailImage: 1, category: 1 } }
            );

            const cursor = productsCollection.aggregate( pipeline );
            const products = await cursor.toArray();
            res.json( products );
        } );

        // ? GET SubCategories by Category
        app.get( '/sub_categories', async ( req, res ) => {
            const category = req.query.category;
            const pipeline = [
                { $match: { category: category } },
                { $group: { _id: null, subCategories: { $addToSet: "$subCategory" } } },
                { $project: { _id: 0, subCategories: 1 } }
            ];

            try {
                const cursor = productsCollection.aggregate( pipeline );
                const result = await cursor.toArray();
                const subCategories = result.length > 0 ? result[ 0 ].subCategories : [];
                res.json( subCategories );
            } catch ( err ) {
                console.error( 'Failed to retrieve subcategories:', err );
                res.status( 500 ).json( { error: 'Failed to retrieve subcategories' } );
            }
        } );

        // ? GET Products by Category
        app.get( '/products/filter_by_category', async ( req, res ) => {
            const category = req.query.category;
            const cursor = productsCollection.find( { category: category } );
            const products = await cursor.toArray();
            res.json( products );
        } );

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


app.listen( port, '0.0.0.0', () => {
    console.log( `TimToys Server is running on port ${ port }` );
} );

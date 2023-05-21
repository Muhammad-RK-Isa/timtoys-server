import express from "express";
import * as dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import * as objectId from 'mongodb';

const app = express();
const port = process.env.PORT || 5000;
dotenv.config();
app.use( express.json() );
app.use( cors() );

// const corsConfig = {
//     origin: '',
//     credentials: true,
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
// };
// app.use( cors( corsConfig ) );
// app.options( '', cors( corsConfig ) );

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
        client.connect();

        const database = client.db( 'timToys' );
        const productsCollection = database.collection( 'products' );

        // ? GET Single Product's Data
        app.get( '/product/:_id', async ( req, res ) => {
            const { _id } = req.params;
            const cursor = productsCollection.findOne( { _id: new ObjectId( _id ) } );
            const product = await cursor;
            res.json( product );
        } )

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

        // ? GET all the uniques Categories
        app.get( '/categories', async ( req, res ) => {
            try {
                const pipeline = [
                    { $group: { _id: '$category' } },
                    { $sort: { _id: 1 } }, // Sort the categories in ascending order by _id
                    { $project: { _id: 1, category: '$_id' } }
                ];

                const categories = await productsCollection.aggregate( pipeline ).toArray();
                res.json( categories );
            } catch ( err ) {
                console.error( 'Failed to retrieve categories:', err );
                // res.status(500).json({ error: 'Failed to retrieve categories' });
            }
        } );



        // ? GET SubCategories by Category
        app.get( '/sub_categories', async ( req, res ) => {
            const category = req.query.category;
            const pipeline = [
                { $match: { category: category } },
                { $group: { _id: null, subCategories: { $addToSet: "$subCategory" } } },
                { $project: { _id: 0, subCategories: 1 } },
                { $unwind: "$subCategories" }, // Unwind the subCategories array
                { $sort: { subCategories: 1 } }, // Sort the subCategories in ascending order
                { $group: { _id: null, subCategories: { $push: "$subCategories" } } }, // Group the subCategories back into an array
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


app.listen( port, "0.0.0.0", () => {
    console.log( `TimToys Server is running on port ${ port }` );
} );

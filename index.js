import express from "express";
import * as dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import jwt from "jsonwebtoken";

const app = express();
const port = process.env.PORT || 5000;
dotenv.config();
app.use( express.json() );
app.use( cors() );

const corsConfig = {
    origin: '',
    credentials: true,
    methods: 'GET,PUT,POST,DELETE',
};

app.use( cors( corsConfig ) );
app.options( '', cors( corsConfig ) );

const uri = `mongodb+srv://${ process.env.MDB_USER }:${ process.env.MDB_PASSWORD }@cluster0.9wh3o6k.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient( uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
} );

const verifyJWT = ( req, res, next ) => {
    const { authorization } = req.headers;
    const token = authorization.split( ' ' )[ 1 ];

    jwt.verify( token, process.env.ACCESS_TOKEN_SECRET, ( err, decoded ) => {
        if ( err ) {
            return res.status( 403 ).send( { error: true, message: 'Forbidden' } );
        }
        next();
    } );
};


app.post( '/auth/request_access_token', ( req, res ) => {
    const { uid } = req.body;
    console.log( uid );
    const token = jwt.sign( uid, process.env.ACCESS_TOKEN_SECRET );
    res.send( { token } );
} );

const run = async () => {
    try {
        client.connect();

        const database = client.db( 'timToys' );
        const productsCollection = database.collection( 'products' );
        const blogsCollection = database.collection( 'blogs' );
        const userDataCollection = database.collection( 'userData' );

        //  ? GET Filter/Sort Products
        app.get( '/products/filter', async ( req, res ) => {
            const page = parseInt( req.query.page );
            const sortby = req.query.sortby;
            const limit = parseInt( req.query.limit );
            const sellerId = req.query.sellerId;

            const skip = ( page - 1 ) * limit;

            let pipeline = [
                { $skip: skip },
                { $limit: limit }
            ];

            let sort = null;
            switch ( sortby ) {
                case "Sort by name A-Z":
                    sort = { title: 1 };
                    break;
                case "Sort by name Z-A":
                    sort = { title: -1 };
                    break;
                case "Price high to low":
                    sort = { price: -1 };
                    break;
                case "Price low to high":
                    sort = { price: 1 };
                    break;
                case "Sort by popularity":
                    sort = { stars: -1 };
                    break;
                case 'Sort Products':
                    sort = null;
                    break;
            }

            if ( sort ) {
                pipeline.unshift( { $sort: sort } );
            }

            if ( sortby === "Sort by popularity" ) {
                pipeline.unshift( { $match: { stars: { $ne: null } } } );
            }

            // Add a $match stage to filter products by seller ID
            if ( sellerId ) {
                pipeline.unshift( { $match: { "seller.id": sellerId } } );
            }

            try {
                const cursor = productsCollection.aggregate( pipeline );
                const products = await cursor.toArray();
                res.json( products );
            } catch ( error ) {
                console.log( error );
                res.status( 500 ).send( 'Internal Server Error' );
            }
        } );

        //  ? GET Products according to quantity 
        app.get( '/products/get_by_quantity', async ( req, res ) => {
            try {
                const quantity = parseInt( req.query.quantity );
                const pipeline = [
                    { $sample: { size: quantity } }
                ];
                const cursor = productsCollection.aggregate( pipeline );
                const products = await cursor.toArray();
                res.json( products );
            } catch ( error ) {
                console.log( error );
            }
        } );

        //  ? GET Random product images 
        app.get( '/products/images', async ( req, res ) => {
            try {
                const pipeline = [
                    { $sample: { size: 5 } },
                    { $project: { thumbnailImage: 1, _id: 0 } }
                ];
                const cursor = productsCollection.aggregate( pipeline );
                const products = await cursor.toArray();
                const images = products.map( product => product.thumbnailImage );
                res.json( images );
            } catch ( error ) {
                console.log( error );
            }
        } );

        // ? GET Single Product's Data
        app.get( '/product/:_id', async ( req, res ) => {
            const { _id } = req.params;
            try {
                const cursor = productsCollection.findOne( { _id: new ObjectId( _id ) } );
                const product = await cursor;
                res.json( product );
            } catch ( error ) {
                console.log( error );
            }
        } );

        // ? POST Add A New Product. Also, Store The User Details In Users Collection
        app.post( '/products/add_product', async ( req, res ) => {
            const { title, thumbnailImage, seller, description, price, listPrice, features, attributes, brand, category, quantity } = req.body;
            const isExisting = await productsCollection.findOne( { title: title, 'seller.id': seller.id } );
            if ( !isExisting ) {
                const newProduct = {
                    title,
                    thumbnailImage,
                    description,
                    seller,
                    price: parseFloat( price ),
                    listPrice: parseFloat( listPrice ),
                    features,
                    attributes,
                    brand,
                    manufacturerAttributes: null,
                    category,
                    quantity: parseFloat( quantity ),
                    inStock: true,
                    reviewsCount: 0,
                    stars: 0
                };
                const result = await productsCollection.insertOne( newProduct );
                res.json( result );
            } else {
                res.json( { messege: 'Product already exists!' } );
            }
        } );

        // ? GET indexing/ search using string params
        app.get( '/products/search', async ( req, res ) => {
            const searchString = req.query.string;
            const limit = parseInt( req.query.limit );
            const page = req.query.page;
            const sellerId = req.query.sellerId;

            const query = {
                title: { $regex: searchString, $options: 'i' }
            };

            if ( sellerId ) {
                query[ 'seller.id' ] = sellerId;
            }

            const skip = ( page - 1 ) * limit;

            const options = {
                limit: limit,
                skip: skip
            };

            try {
                const cursor = productsCollection.find( query, options );
                const result = await cursor.toArray();
                res.json( result );
            } catch ( error ) {
                console.log( error );
                res.status( 500 ).send( 'Internal Server Error' );
            }
        } );


        // ? GET Products by Category
        app.get( '/products/filter_by_category', async ( req, res ) => {
            try {
                const category = req.query.category;
                const cursor = productsCollection.find( { category: category } );
                const products = await cursor.toArray();
                res.json( products );
            } catch ( error ) {
                console.log( error );
            }
        } );

        // ? GET Number of products
        app.get( '/products/count', async ( req, res ) => {
            try {
                const { sellerId } = req?.query;
                if ( sellerId ) {
                    const filter = { 'seller.id': sellerId };
                    const productsCount = await productsCollection.countDocuments( filter );
                    res.send( { productsCount } );
                } else {
                    const productsCount = await productsCollection.estimatedDocumentCount();
                    res.send( { productsCount } );
                }

            } catch ( error ) {
                console.log( error );
                res.status( 500 ).send( 'Internal Server Error' );
            }
        } );

        // ? PUT Update single product data
        app.put( '/product/:_id', async ( req, res ) => {
            const { _id } = req.params;
            const { title, thumbnailImage, seller, description, price, listPrice, features, attributes, brand, category, quantity } = req.body;

            const updateData = {
                ...( title && { title } ),
                ...( thumbnailImage && { thumbnailImage } ),
                ...( seller && { seller } ),
                ...( description && { description } ),
                ...( price && { price: parseFloat( price ) } ),
                ...( listPrice && { listPrice: parseFloat( listPrice ) } ),
                ...( features && { features } ),
                ...( attributes && { attributes } ),
                ...( brand && { brand } ),
                ...( category && { category } ),
                ...( quantity && { quantity: parseFloat( quantity ) } ),
            };

            try {
                const result = await productsCollection.findOneAndUpdate(
                    { _id: new ObjectId( _id ) },
                    { $set: updateData },
                    { returnOriginal: false },
                );
                res.send( result );
                console.log( result );
            } catch ( error ) {
                console.log( error );
                res.status( 500 ).send( 'Internal Server Error' );
            }
        } );

        // ! DELETE A Product
        app.delete( '/product/:_id', async ( req, res ) => {
            const { _id } = req.params;
            try {
                const isValidId = ObjectId.isValid( _id );
                if ( !isValidId ) {
                    return res.status( 400 ).json( { message: 'Invalid ID format' } );
                }

                // Delete the product from the products collection
                const result = await productsCollection.deleteOne( { _id: new ObjectId( _id ) } );

                if ( result.deletedCount === 1 ) {
                    return res.sendStatus( 204 );
                } else {
                    return res.status( 404 ).json( { message: 'Product not found' } );
                }
            } catch ( error ) {
                console.log( error );
                return res.status( 500 ).json( { message: 'Internal Server Error' } );
            }
        } );

        // ? GET Blogs
        app.get( '/blogs/all', async ( req, res ) => {
            const cursor = blogsCollection.find();
            const blogs = await cursor.toArray();
            res.json( blogs );
        } );

        // ? PUT Upsert a blog
        app.put( '/user/blogs', verifyJWT, async ( req, res ) => {
            const { userId, blogId } = req.body;

            try {
                const result = await userDataCollection.updateOne(
                    { uid: userId },
                    { $addToSet: { blogs: blogId } },
                    { upsert: true }
                );

                if ( result.upsertedCount > 0 ) {
                    res.status( 201 ).json( { message: 'New document created' } );
                } else {
                    res.status( 200 ).json( { message: 'Document updated' } );
                }
            } catch ( error ) {
                console.error( 'Error saving/updating document:', error );
                res.status( 500 ).json( { error: 'An error occurred while saving/updating the document' } );
            }
        } );

        // ! DELETE a blog from a user data
        app.delete( '/user/blogs', verifyJWT, async ( req, res ) => {
            const { userId, blogId } = req.body;

            try {
                const result = await userDataCollection.updateOne(
                    { uid: userId },
                    { $pull: { blogs: { $in: [ blogId ] } } }
                );

                if ( result.modifiedCount > 0 ) {
                    res.status( 200 ).json( { message: 'Blog unpinned' } );
                } else {
                    res.status( 404 ).json( { message: 'Blog not found' } );
                }
            } catch ( error ) {
                console.error( 'Error deleting blog', error );
                res.status( 500 ).json( { error: 'An error occurred while unpinning the blog' } );
            }
        } );

        // ? GET Pinned Blogs
        app.get( '/user/blogs/:userId', verifyJWT, async ( req, res ) => {
            const { userId } = req.params;

            try {
                const pipeline = [
                    { $match: { uid: userId } },
                    { $project: { blogs: 1, _id: 0 } }
                ];

                const blogs = await userDataCollection.aggregate( pipeline ).toArray();

                res.status( 200 ).json( blogs[ 0 ].blogs );
            } catch ( error ) {
                res.status( 404 ).json( { error: 'No pinned blog found' } );
            }
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

import * as web3 from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { initializeKeypair } from "./initializeKeypair";

import * as fs from "fs";
import {
  bundlrStorage,
  findMetadataPda,
  keypairIdentity,
  Metaplex,
  toMetaplexFile,
} from "@metaplex-foundation/js";

import {
  DataV2,
  createCreateMetadataAccountV2Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

const TOKEN_NAME = "Hidan_WR";
const TOKEN_SYMBOL = "HW";
const TOKEN_DESCRIPTION = "A token for anime lovers";
const TOKEN_IMAGE_NAME = "hidan.png"; // Replace unicorn.png with your image name
const TOKEN_IMAGE_PATH = `tokens/bld/assets/${TOKEN_IMAGE_NAME}`;

async function createBldToken(
  connection: web3.Connection,
  payer: web3.Keypair
) {
    //In here, we're calling the createMint function to create an intialize a new mint.
    // This will create a token with all the necessary inputs
    const tokenMint = await token.createMint(
        connection, // Connection
        payer, // Payer
        payer.publicKey, // Your wallet public key
        payer.publicKey, // Freeze authority
        2 // Decimals
    );

    //Next, we're creating a metaplex object so that it can generate a metaplex metadata and upload it to bundlrStorage.
    // Create a metaplex object so that we can create a metaplex metadata
    const metaplex = Metaplex.make(connection)
        .use(keypairIdentity(payer))
        .use(
        bundlrStorage({
            address: "https://devnet.bundlr.network",
            providerUrl: "https://api.devnet.solana.com",
            timeout: 60000,
        })
        );

    //This section is pretty self explanatory. 
    //We're now trying to read the image file that we placed in the bld/assets folder and upload the metadata to the storage.
    // Read image file
    const imageBuffer = fs.readFileSync(TOKEN_IMAGE_PATH);//token_image_path
    const file = toMetaplexFile(imageBuffer, TOKEN_IMAGE_NAME);
    const imageUri = await metaplex.storage().upload(file);

    // Upload the rest of offchain metadata
    const { uri } = await metaplex
        .nfts()
        .uploadMetadata({
        name: TOKEN_NAME,
        description: TOKEN_DESCRIPTION,
        image: imageUri,
        })

    //Once we've successfully uploaded our image to metaplex, 
    // we'll then fetch the address by calling the following section below.
    // Finding out the address where the metadata is stored
    const metadataPda = findMetadataPda(tokenMint);
    const tokenMetadata = {
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        uri: uri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
    } as DataV2

    const instruction = createCreateMetadataAccountV2Instruction({
        metadata: metadataPda,
        mint: tokenMint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey
    },
    {
        createMetadataAccountArgsV2: {
            data: tokenMetadata,
            isMutable: true
        }
    })

    const transaction = new web3.Transaction()
    transaction.add(instruction)

    const transactionSignature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
    )

/*Storing of metadata
Now that we've created our mint with all the metadata below. 
Let's move on to the next step! We'll now be writing our metadata file to our folder by writing this code in.
Just below where you defined your transactionSignature, let's place this code in.*/
    fs.writeFileSync(
        "tokens/bld/cache.json",
        JSON.stringify({
        mint: tokenMint.toBase58(),
        imageUri: imageUri,
        metadataUri: uri,
        tokenMetadata: metadataPda.toBase58(),
        metadataTransaction: transactionSignature,
        })
    );

}



async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
  const payer = await initializeKeypair(connection);

  await createBldToken(connection, payer);
}

main()
  .then(() => {
    console.log("Finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
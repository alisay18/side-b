import {cpSync,mkdirSync} from 'node:fs';
mkdirSync('public',{recursive:true});cpSync('frontend','public',{recursive:true});

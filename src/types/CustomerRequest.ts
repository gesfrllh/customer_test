
import { Request } from 'express';
import { DecodedUser } from '../models/DecodedUser'; 

interface CustomRequest extends Request {
    customer?: DecodedUser;
}

export default CustomRequest;

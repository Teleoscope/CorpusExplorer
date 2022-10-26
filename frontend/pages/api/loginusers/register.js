const bcrypt = require('bcryptjs');

import { apiHandler, usersRepo } from '../../../helpers/index';

export default apiHandler({
    post: register
});

function register(req, res) {

    console.log('Req Body', req.body);
    // split out password from user details 
    const { password, ...user } = req.body;
    console.log('Registration Req', req.body)

    // validate
    if (usersRepo.find(x => x.username === user.username))
        throw `User with the username "${user.username}" already exists`;

    // hash password
    user.hash = bcrypt.hashSync(password, 10);    

    usersRepo.create(user);
    return res.status(200).json({});
}
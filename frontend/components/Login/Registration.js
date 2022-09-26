import React, { useState } from 'react'

//mui
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { IconButton } from '@mui/material';

// actions
import { useDispatch } from "react-redux";
import { register } from "../../actions/registration"

export default function Registration(props) {

   const [details, setDetails] = useState({ name: '', email: '', password: '' });
   const [passwordVisibility, setPasswordVisibility] = useState(false);
   const [registered, setRegistered] = useState(false);
   const dispatch = useDispatch();

   // checks to see if all the fields are filled out 
   // and dispathes it to the store
   const submitHandler = e => {
      e.preventDefault()
      // displays the header tag saying that the account was registered
      setRegistered(!registered);

      // dispatches the users information to the store
      dispatch(register(details));

      // wait a second to display that the account was successfully registered
      // before returning to the login page
      setTimeout(() => {
         props.setRegistration()
       }, 1000);
   }


   return (
      <div>
         {/* // when the form is sumbitted the user information
         // will be sent to the registration reducer */}
         <form onSubmit={submitHandler}>
            <h2>Teleoscope Account Registration</h2>
            <div className='form-group'>
               <label htmlFor='name'>Name:</label>
               <input type="text" name='registration-name' id='registration-name' onChange={e => setDetails({ ...details, name: e.target.value })} value={details.name} />
            </div>
            <div className='form-group'>
               <label htmlFor='email'>Email:</label>
               <input type='email' name='registration-email' id='registration-email' onChange={e => setDetails({ ...details, email: e.target.value })} value={details.email} />
            </div>
            <div className='form-group'>
               <label htmlFor='password'>Password:</label>
               <input type={passwordVisibility ? "text" : "password"} name='registration-password' id='registration-password' onChange={e => setDetails({ ...details, password: e.target.value })} value={details.password} />
               <IconButton>
                  {passwordVisibility ?
                     <VisibilityIcon onClick={() => setPasswordVisibility(!passwordVisibility)} /> :
                     <VisibilityOffIcon onClick={() => setPasswordVisibility(!passwordVisibility)} />}
               </IconButton>

            </div>
            <input type='submit' value='REGISTER' />
         </form >
         <button onClick={() => props.setRegistration()}>BACK</button>
         {registered ? (
            <h4>ACCOUNT REGISTERED</h4>
         ) : (
            <h4>REGISTER ACCOUNT HERE</h4>
         )
         }
      </div>
   )
}

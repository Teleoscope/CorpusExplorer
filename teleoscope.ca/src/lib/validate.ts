export const validateEmail = (email: string | FormDataEntryValue): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.toString());
  };

export const validatePassword = (password: string | FormDataEntryValue): boolean => {
    const regex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z\d]).{8,}$/;
    return regex.test(password.toString());
  };

export const errors = {
    missing: {
      error: "No email or password"
    },
    email: {
      error: "Invalid email."
    },
    
    password: {
      error: "Invalid password."
    },

    incorrect: {
      error: "Incorrect username or password."
    },

    exists: {
      error: "Email exists."
    },

    unknown: {
      error: "Unknown error."
    },
    

}

export interface ActionResult {
	error: string;
}
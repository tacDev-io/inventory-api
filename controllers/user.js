import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { User } from "../models/user.js";
import { Location } from "../models/location.js";
import { Business } from "../models/business.js";
import { Product } from "../models/product.js";
import { Inventory } from "../models/inventory.js";

import sendGridMail from "@sendgrid/mail";

// ON DEPLOYMENT, SWITCH TO "process.env.SENDGRID_API_KEY"
sendGridMail.setApiKey(process.env.SENDGRID_API_KEY);

// CREATE NEW USER
export const signup = async (req, res, next) => {
  console.log(req.body);

  try {
    const hash = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      email: req.body.email,
      password: hash,
      userProfile: {
        role: req.body.userProfile.role,
        department: req.body.userProfile.department,
        firstName: req.body.userProfile.firstName,
        lastName: req.body.userProfile.lastName,
        phoneNumber: req.body.userProfile.phoneNumber,
        themePref: req.body.userProfile.themePref,
        businessId: req.body.userProfile.businessId,
        location: req.body.userProfile.location,
      },
    });

    // CUSTOM "UNIQUE EMAIL" VALIDATOR
    try {
      const checkEmailUnique = await User.findOne({ email: req.body.email });
      console.log("||| checking email unique |||");
      console.log(checkEmailUnique);
      if (checkEmailUnique && checkEmailUnique.email) {
        res.status(422).json({
          message:
            "Email already in use. Please sign in or create your account with a different email.",
        });
      }
    } catch (error) {
      console.log(error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Signup failed! Please try again.",
          message: error,
        });
      }
    }
    // CUSTOM "UNIQUE EMAIL" VALIDATOR // END

    const newUser = await user.save();

    sendGridMail.send({
      to: req.body.email,
      from: "info@calebdickson.com",
      subject: "Welcome to InventoryApp!",
      html: `<style>
      main {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
          Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      }
      .title {
        color: #363636;
      }
    </style>
    <main>
      <body>
        <h1 class="title">You have successfully signed up for "Inventory App"</h1>
        <p>Welcome!</p>
        <p>Click <a href="http://localhost:4200">here</a> to confirm your email</p>
      </body>
    </main>`,
    });

    res.status(201).json({
      message: "Signup successful! Check your email.",
      result: newUser,
    });
  } catch (error) {
    console.log(error);
    if (!res.headersSent) {
      res.status(500).json({
        message: error,
      });
    }
  }
};
// CREATE NEW USER /// END

// USER LOGIN
export const login = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(422).json({
        message: "Login failed. User not found.",
      });
    } else if (user) {
      const bcryptRes = await bcrypt.compare(req.body.password, user.password);
      if (!bcryptRes) {
        res.status(401).json({
          message: "Login failed. Password incorrect.",
        });
      }
    }

    const userToken = jwt.sign(
      {
        email: user.email,
        userId: user._id,
        userRole: user.userProfile.role,
        userDept: user.userProfile.department
      },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      token: userToken,
      expiresIn: 3600,
      user: user,
      userId: user._id,
    });
  } catch (error) {
    console.log(error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: error,
      });
    }
  }
};
// USER LOGIN /// END

export const deleteUser = async (req, res, next) => {
  try {

    const user = await User.findById(req.params.userId);

    // NON-ADMIN MANAGERS
    // and
    // NON-OWNER ADMINS
    if (
      (user && +user.userProfile.role === 2) ||
      (
        user &&
        user.userProfile.department === 'admin' &&
        +user.userProfile.role !== 3
      )
    ) {
      const userLocations = await Location.find({ "managers.manager": req.params.userId });

      userLocations.forEach(location => {
        location.removeManager(user._id);
      });

      const deletedRes = await User.deleteOne({ _id: req.params.userId });

      if (+deletedRes.deletedCount === 1) {
        res.status(200).json({ message: 'Account removed.' });
      } else {
        res.status(500).json({ message: 'Unknown server error.' });
      }

      // JUNIOR STAFFMEMBERS
    } else if (user && (user.userProfile.department !== 'admin' || +user.userProfile.role === 1)) {
      const userLocations = await Location.find({ "staff.staffMember": req.params.userId });

      userLocations.forEach(location => {
        location.removeStaffmember(user._id);
      });

      const deletedRes = await User.deleteOne({ _id: req.params.userId });

      if (+deletedRes.deletedCount === 1) {
        res.status(200).json({ message: 'Account removed.' });
      } else {
        res.status(500).json({ message: 'Unknown server error.' });
      }

      // OWNERS
    } else if (user && +user.userProfile.role === 3) {
      const ownersBusiness = await Business.findOne({
        ownerId: req.params.userId
      })
        .populate({
          path: "locations.location",
          model: "Location"
        });
      console.log(ownersBusiness);
      console.log('||| ^^^ found ownersBusiness ^^^ |||');


      let locationsDeleted;
      if (ownersBusiness.locations.length > 0) {
        for (const location of ownersBusiness.locations) {
          await Product.deleteMany({ parentOrg: location.location });
          await Inventory.deleteMany({ parentLocation: location.location });
        }
        locationsDeleted = await Location.deleteMany({ parentBusiness: ownersBusiness._id });
      }


      const businessDeleted = await Business.deleteOne({ _id: ownersBusiness._id });


      const userDeleted = await User.deleteOne({ _id: req.params.userId });


      if (
        +businessDeleted.deletedCount === 1 &&
        +userDeleted.deletedCount === 1
      ) {
        if (+userDeleted.deletedCount === 1) {
          res.status(200).json({ message: 'User and all of Business deleted.' });
        } else {
          res.status(500).json({ message: 'Business deleted. A server error occurred while deleting this User.' })
        }
      } else {
        res.status(500).json({ message: 'A server error occurred while deleting this Business.' })
      }

    }

  } catch (error) {
    console.log(error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: error,
      });
    }
  }
}

export const resetPassInit = async (req, res, next) => {
  crypto.randomBytes(32, async (err, buffer) => {
    if (err) {
      res.status(500).json({
        message: 'Server encountered an error while preparing to reset the password. Please refresh the page and try again.'
      });
    }

    try {
      const token = buffer.toString('hex');
      const user = await User.findOne({ email: req.body.email });


      if (!user) {
        res.status(200).json({
          message: 'Done! If this account exists, a password reset link will be sent to ' + req.body.email + '. Check your email.'
        });
      } else {
        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          {
            resetToken: token,
            resetTokenExpiration: Date.now() + 3600000
          });

        if (updatedUser) {

          await sendGridMail.send({
            to: req.body.email,
            from: "info@calebdickson.com",
            subject: "{Inventory} Password Reset",
            html: `<style>
                main {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
                    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
                }
                .title {
                  color: #363636;
                }
              </style>
              <main>
                <body>
                  <h1 class="title">Here is the link to reset your password</h1>
                  <p>Click <a href="http://localhost:4200/reset-password/${token}">here</a> to reset your password.</p>
                  <p>This link will expire in 1 hour.</p>
                </body>
              </main>`,
          });

          res.status(200).json({
            message: 'Done! If this account exists, a password reset link will be sent to ' + req.body.email + '. Check your email.'
          });

        } else {
          res.status(500).json({ message: 'Server encountered an error while preparing to reset the password. Please refresh the page and try again.' })
        }
      }


    } catch (error) {
      console.log(error);
      if (!res.headersSent) {
        return res.status(500).json({
          message: error,
        });
      }
    }

  });

}

export const checkPassResetToken = async (req, res, next) => {
  console.log(req.params.token);

  try {

    const foundUser = await User.findOne(
      {
        resetToken: req.params.token,
        resetTokenExpiration: {
          $gt: Date.now()
        }
      });

    if (foundUser) {
      res.status(200).json({ userId: foundUser._id })
    } else {
      res.status(401).json({ message: 'This password reset link has expired. Please try again or proceed to log in.' })
    }

  } catch (error) {
    console.log(error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: error,
      });
    }
  }
}

export const resetPass = async (req, res, next) => {

  try {

    const resettingUser = await User.findOne(
      {
        resetToken: req.body.token,
        resetTokenExpiration: { $gt: Date.now() },
        _id: req.body.userId
      });

    if (resettingUser) {
      const hashedPass = await bcrypt.hash(req.body.newPass, 10);
      const userWithNewPass = await User.findByIdAndUpdate(
        resettingUser._id,
        {
          password: hashedPass,
          resetToken: null,
          resetTokenExpiration: null
        });
      res.status(200).json(
        {
          message: 'Your password has been reset. You may now log in with your new password.'
        });
    } else {
      res.status(500).json(
        {
          message: 'An error has occured while resetting your password. Please refresh the page and try again.'
        }
      )
    }


  } catch (error) {
    console.log(error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: error,
      });
    }
  }

}

export const updateUser = async (req, res, next) => {
  console.log(req.file);
  console.log("||| ^^^ req.file ^^^ |||");
  console.log(req.body);
  console.log("||| ^^^ req.body ^^^ |||");
  let imagePath;
  if (req.file) {
    const url = req.protocol + "://" + req.get("host");
    imagePath = url + "/images/users/" + req.file.filename;
    console.log(imagePath);
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.body.userId,
      {
        // email: req.body.email,
        // "userProfile.role": req.body.role,
        // "userProfile.department": req.body.department,
        "userProfile.firstName": req.body.firstName,
        "userProfile.lastName": req.body.lastName,
        "userProfile.phoneNumber": req.body.phoneNumber,
        "userProfile.themePref": req.body.themePref,
        "userProfile.userPhoto": imagePath,
      },
      { new: true }
    );
    console.log(updatedUser);
    console.log("||| ^^^ updatedUser ^^^ |||");

    if (updatedUser) {
      res.status(200).json({ updatedUser: updatedUser });
    } else {
      res
        .status(500)
        .json({ message: "An unknown server error has occurred." });
    }
  } catch (error) {
    console.log(error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: error,
      });
    }
  }
};

// ||| Unfinished Unfinished Unfinished Unfinished Unfinished |||
// FETCH ALL LOCATIONS WHERE USER IS AUTHORIZED
export const getUserLocations = async (req, res, next) => {
  try {
    if (+req.params.userRole === 2) {
      const userLocations = await Location.find({ manager: req.params.userId });
    }
    if (+req.params.userRole === 1) {
      const userLocations = await Location.find({
        staffMember: req.params.userId,
      });
    }
    console.log(userLocations);
    console.log("||| ^^^ userLocations here ^^^");

    if (userLocations) {
      res.status(200).json({ fetchedLocations: userLocations });
    }
    if (!userLocations) {
      res
        .status(404)
        .json({ message: "No authorized locations were found for this user." });
    }
  } catch (error) {
    // CATCH AND RETURN UNEXPECTED ERRORS
    console.log(error);
    res.status(500).json({
      message: error._message,
    });
  }
};
// FETCH ALL LOCATIONS WHERE USER IS AUTHORIZED /// END

import mongoose from "mongoose";

import { User } from "../models/user.js";
import { Inventory } from "./inventory.js";

const locationSchema = mongoose.Schema({
  locationName: { type: String, required: true },
  parentBusiness: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Business",
  },
  managers: [
    {
      manager: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "User",
      },
    },
  ],
  staff: [
    {
      staffMember: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "User",
      },
    },
  ],
  productList: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "Product",
      },
    },
  ],
  inventoryData: [
    {
      inventory: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "Inventory",
      },
    },
  ],
  locationPhoto: {
    type: String,
    required: true,
    default: "http://inventory.us-east-1.elasticbeanstalk.com/images/locations/location_photo_default.png",
  },
});

// USED TO UPDATE SIMPLE LOCATION DATA AND RETURN THE LATEST FROM DB
locationSchema.methods.updateLocation = async function (locationUpdateData) {
  this.locationName = locationUpdateData.locationName;
  this.parentBusiness = locationUpdateData.parentBusiness;
  this.productList = locationUpdateData.productList;
  this.inventoryData = locationUpdateData.inventoryData;

  return this.save();
};

// ADD NEW INVENTORY DATA
locationSchema.methods.addNewInventory = async function (newInventory) {
  console.log(newInventory);
  console.log("||| schemaMethod arg newInventory ^^^ |||");

  this.inventoryData.push({ inventory: newInventory });
  console.log(this.inventoryData);
  console.log("||| updated inventoryData array ^^^ |||");

  return this.save();
};

locationSchema.methods.removeManager = async function (userId) {
  let arr = [];

  for (const manager of this.managers) {
    if (manager.manager.toString() != userId) {
      arr.push(manager);
    }
  }

  this.managers = [...arr];
  console.log(this.managers)

  return this.save();
}

locationSchema.methods.removeStaffmember = async function (userId) {
  let arr = [];

  for (const staff of this.staff) {
    if (staff.staffMember.toString() != userId) {
      arr.push(staff);
    }
  }

  this.staff = [...arr];
  console.log(this.staff);

  return this.save();
}

// TO ADD A LIST OF AUTHORIZED MANAGERS (User Refs) TO A LOCATION BY EMAIL
locationSchema.methods.addManagers = async function (managerEmails) {
  const currentManagers = this.managers;
  let newManagers = [];

  // FIND AND RETURN ANY MANAGER USERS WITH MATCHING EMAILS QUERY
  let foundManagers = await User.find({
    email: { $in: managerEmails },
    "userProfile.role": 2,
  });
  console.log(foundManagers);
  console.log("||| found managers here ^^^ |||");

  foundManagers.forEach((manager) => {
    newManagers.push({ manager: manager._id });
  });

  // IF NEW MANAGERS WERE FOUND AND ADDED
  if (newManagers.length > currentManagers.length) {
    // NEW ARRAY OF CURRENT MANAGERS
    let currentManagers = [...this.managers];

    let updatedManagers = currentManagers.concat(newManagers);

    this.managers = updatedManagers;

    return this.save();
    // IF NO MANAGERS WERE ADDED
  } else if (newManagers.length <= currentManagers.length) {
    return "Not found.";
  }
};

// ADD A LIST OF AUTHORIZED JUNIOR STAFF (User Refs) TO A LOCATION BY EMAIL
locationSchema.methods.addStaff = async function (emails) {
  const currentStaff = this.staff;
  let newStaff = [];

  // FIND AND RETURN ANY MANAGER USERS WITH MATCHING EMAILS QUERY
  let foundStaff = await User.find({
    email: { $in: emails },
    "userProfile.role": 1,
  });
  console.log(foundStaff);
  console.log("||| found staff here ^^^ |||");

  foundStaff.forEach((staffUser) => {
    newStaff.push({ staffMember: staffUser._id });
  });

  // IF NEW MANAGERS WERE FOUND AND ADDED
  if (newStaff.length > currentStaff.length) {
    // NEW ARRAY OF CURRENT MANAGERS
    let currentStaff = [...this.staff];

    let updatedStaff = currentStaff.concat(newStaff);

    this.staff = updatedStaff;

    return this.save();
    // IF NO STAFF MEMBERS WERE ADDED
  } else if (newStaff.length <= currentStaff.length) {
    return "Not found.";
  }
};

locationSchema.methods.addProductToList = async function (newProduct) {
  this.productList.push({ product: newProduct });
  return this.save();
};

locationSchema.methods.removeProductFromList = async function (product) {
  this.productList = this.productList.filter((prodRef) =>
    prodRef.product.toString() !== product
  )
  return this.save();
};

locationSchema.methods.addInventory = async function (newInventory) {
  this.inventoryData.push({ inventory: newInventory });
  return this.save();
};

locationSchema.methods.getInventories = async function () {
  return await Inventory.find({ parentLocation: this._id }).populate({
    path: "inventory.product",
    model: "Product",
  });
};

export const Location = mongoose.model("Location", locationSchema);

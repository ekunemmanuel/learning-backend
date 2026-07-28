import { prisma as db } from "@/lib/prisma";
import { CreateAccountSchema, LoginSchema, VerifyOtpSchema } from "./schema";
import { AppError } from "@/lib/errors";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { generateOTP, hashOtp } from "./utils";



export const createAccount = async (data: CreateAccountSchema) => {

  await db.user.create({ data })

  const otp = generateOTP(4)

  console.log(otp, "Sending OTP to email and phone");

  // create otp
  await db.otp.create({
    data: {
      identifier: data.email,
      code: otp,
      expiresAt: new Date(Date.now() + 60 * 1000),
    },
  });

  return {
    message: 'An OTP has been sent to your Email or Phone for verification'
  }
};

export const verifyOtp = async (data: VerifyOtpSchema) => {
  const { identifier, code } = data;
  // const HASHED_CODE = await hashOtp(code, identifier);

  // verify otp
  const otp = await db.otp.findFirst({
    where: {
      identifier,
      code: code,
    },
  });

  if (!otp) {
    throw new AppError(HttpStatusCodes.BAD_REQUEST, "Invalid OTP");
  }

  if (otp.expiresAt < new Date()) {
    // update otp
    const newOtp = generateOTP(4)

    console.log(newOtp, "Sending OTP to email and phone");
    await db.otp.update({
      where: {
        id: otp.id,
      },
      data: {
        code: newOtp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    throw new AppError(HttpStatusCodes.BAD_REQUEST, "OTP has expired. A new one has been sent to your email and phone");
  }

  // check type of identifier
  if (identifier.includes("@")) {
    await db.user.update({
      where: {
        email: identifier,
      },
      data: {
        isEmailVerified: true,
      },
    });
  } else {
    await db.user.update({
      where: {
        phone: identifier,
      },
      data: {
        isPhoneVerified: true,
      },
    });
  }

  await db.otp.delete({
    where: {
      id: otp.id,
    },
  });

  return {
    message: "Account verified successfully",
  };
};

export const login = async (data: LoginSchema) => {
  // find user
  let user
  const isEmail = data.identifier.includes("@")

  if (isEmail) {
    user = await db.user.findUnique({
      where: {
        email: data.identifier
      }
    })
  } else {
    user = await db.user.findUnique({
      where: {
        phone: data.identifier
      }
    })
  }

  if (!user || user.password != data.password) {
    throw new AppError(400, `Either ${isEmail ? 'email' : "phone"} or password is incorrect`)
  }

  return {
    message: "Login successful"
  }
}
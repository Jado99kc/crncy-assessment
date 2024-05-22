import logger from "./logger";
import csv from "csvtojson";
import { Glob } from "bun";
import type { TokenResponse } from "./types/tokenReponse";
import type { CsvData } from "./types/csv";
import { postingStructure } from "./constants";
import type { PostPaymentResponse } from "./types/postPaymentResponse";
import dayjs from "dayjs";

//declare the test input folder location
const inputFolder = `${__dirname}/input`;

const getFileNames = async () => {
  const glob = new Glob("**/*.csv");

  const fileNames = [];

  //Get the list of files in input directory
  for await (const file of glob.scan(inputFolder)) {
    fileNames.push(file);
  }
  return fileNames;
};

const fetchToken = async () => {
  try {
    const response = await fetch(
      "https://qpfc-uat.vergentlms.com/api/api/authenticate",
      {
        method: "POST",
        body: JSON.stringify({
          LogonName: Bun.env.LogonName,
          password: Bun.env.password,
        }),
        headers: { "Content-Type": "application/json" },
      }
    );

    const { Token } = (await response.json()) as TokenResponse;
    return Token;
  } catch (error) {
    logger.error(`Error fetching token: ${error}`);
    return null;
  }
};

const parseCsv = async (filePath: string) => {
  const contents: CsvData[] = await csv({
    noheader: true,
    headers: ["HeaderId", "PaymentAmount", "InstrumentNumber", "PaymentDate"],
  }).fromFile(filePath);
  return contents;
};

const postPayment = async (payment: CsvData) => {
  try {
    const Token = await fetchToken();
    if (!Token) {
      return null;
    }
    const response = await fetch(
      "https://qpfc-uat.vergentlms.com/api/api/V1/PostCustomerLoanPayment",
      {
        method: "POST",
        body: JSON.stringify({
          ...payment,
          ...postingStructure,
          PaymentDate: dayjs(payment.PaymentDate).format("YYYY-MM-DD"),
        }),
        headers: { "Content-Type": "application/json", Token },
      }
    );
    return (await response.json()) as PostPaymentResponse;
  } catch (error) {
    logger.error(`Failed to post payment ${JSON.stringify(payment)}`);
    return null;
  }
};
const postFileContents = async (contents: CsvData[]) => {
  let postedPayments = 0;
  for (const payment of contents) {
    const postingResult = await postPayment(payment);
    if (postingResult) {
      postedPayments++;
    }
  }
  return postedPayments;
};
const main = async () => {
  // Validate if there are files to be processed
  const fileNames = await getFileNames();
  if (!fileNames.length) {
    logger.error(
      "The input directory is empty or the files in the input folder are not .csv files. Please add valid input files to be processed."
    );
  }

  logger.info(
    `Detected ${fileNames.length} files in input directory. Starting process...`
  );

  for (const file of fileNames) {
    logger.info(`Processing ${file}`);
    const contents = await parseCsv(`${inputFolder}/${file}`);
    const postedPayments = await postFileContents(contents);
    logger.info(
      `Posting completed for file ${file}. ${postedPayments}/${contents.length} posted successfully`
    );
  }

  logger.info(`Process completed successfully`);
};

await main();

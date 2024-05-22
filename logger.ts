import pino from "pino";
import dayjs from "dayjs";
const logger = pino({
  transport: {
    targets: [
      {
        target: "pino-pretty",
      },
      {
        target: "pino/file",
        options: {
          destination: `${__dirname}/logs/${dayjs().format("YYYY-MM-DD")}.log`,
          mkdir: true,
        },
      },
    ],
  },
});

export default logger;

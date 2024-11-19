import { Context, ClientContext } from 'aws-lambda';
import { messagingApi } from '@line/bot-sdk';

type SoracomEventObj = {
    clickType: 1 | 2 | 3,
    clickTypeName: "SINGLE" | "DOUBLE" | "LONG",
    batteryLevel: 0.25 | 0.5 | 0.75 | 1.0,
    binaryParserEnabled: boolean,
};

type SoracomRequestObj = {
    simId: string,
    imsi: string,
    location: {
        lat: number,
        lon: number
    },
};

export const handler = async (event: SoracomEventObj, context: Context): Promise<void> => {
    const soracomAuthKey: string = process.env.SORACOM_AUTH_KEY ?? "";
    const soracomAuthKeyId: string = process.env.SORACOM_AUTH_KEY_ID ?? "";
    const lineToken: string = process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN ?? "";
    const lineGroupId: string = process.env.LINE_TRAP_NOTIFY_GROUP_ID_BY_SUZUKI ?? "";

    if (soracomAuthKey === "" || soracomAuthKeyId === "" || lineGroupId === "" || lineToken === "") {
        console.error("soracomAuthKey: ", soracomAuthKey);
        console.error("soracomAuthKeyId: ", soracomAuthKeyId);
        console.error("lineGroupId: ", lineGroupId);
        console.error("lineToken: ", lineToken);

        throw new Error("Environment variable is not set.");
    }

    console.log(`Event: ${JSON.stringify(event, null, 4)}`);
    console.log(`Context: ${JSON.stringify(context, null, 4)}`);

    let requestObj: SoracomRequestObj;
    if (context.clientContext == null) {
        console.info("----------------------------------");
        console.log("[This TEST REQUEST] set test env.");
        console.info("----------------------------------");

        requestObj = {
            imsi: "test_imsi",
            simId: process.env.TEST_SIM_ID ?? "",
            location: {
                lat: Number(process.env.TEST_LAT),
                lon: Number(process.env.TEST_LON)
            }
        }

    } else {
        requestObj = context.clientContext as unknown as SoracomRequestObj;
    }

    console.log(`requestObj : ${JSON.stringify(requestObj, null, 4)}`);

    const soracomApi = new SoracomApi(soracomAuthKey, soracomAuthKeyId);
    await soracomApi.auth();
    let simData: SoracomSimData = await soracomApi.getSimData(requestObj.simId);

    const lineApi = new LineApi(lineToken);
    let messageObj: LineGroupMessageObj = {
        simData: simData,
        soracomReq: requestObj,
        soracomEvent: event,
    };

    console.info("------ send line ----------");
    console.info("lineGroupId: ", lineGroupId);
    console.info("messageObj: ", messageObj);
    console.info("------ send line ----------");

    await lineApi.sendGroup(lineGroupId, messageObj);
};

type SoracomApiAuth = {
    authKey: string,
    authKeyId: string
};

type SoracomApiAuthRes = {
    apiKey: string,
    operatorId: string,
    token: string,
    userName: string
};

type SoracomSimData = {
    simName: string,
};

class SoracomApi {
    // 実質定数
    private readonly SORACOM_API_BASE_URI = "https://api.soracom.io/v1";

    private authObj: SoracomApiAuth; 
    private defaultHedaers: Headers;
    private authHeaders: Headers | undefined;

    constructor(private authKey: string, private authKeyId: string) {
        this.authObj = {
            authKey: authKey,
            authKeyId: authKeyId
        };

        this.defaultHedaers = new Headers({
            "Content-Type": "application/json"
        });

        console.log(`Soracom API constructor authObj : ${JSON.stringify(this.authObj, null, 4)}`);
        console.log(`Soracom API constructor defaultHedaer : `, this.defaultHedaers);
    }

    async auth(): Promise<void> {
        let reqInitObj: RequestInit = {
            method: "POST",
            headers: this.defaultHedaers,
            body: JSON.stringify(this.authObj),

        };

        console.log(`soracom api to auth(). reqInitObj: `, reqInitObj);

        return await fetch(this.SORACOM_API_BASE_URI + "/auth", reqInitObj)
            .then(async res => {
                if (!res.ok) {
                    console.error(`faild soracom api to auth() request response:`, res);
                    throw new Error("faild soracom api to auth() request.");
                }

                const body: SoracomApiAuthRes = await res.json() as unknown as SoracomApiAuthRes;
                console.log(`soracom api to auth() success response. body: `, body);

                this.authHeaders = this.defaultHedaers && new Headers({
                    "X-Soracom-API-Key": body.apiKey,
                    "X-Soracom-Token": body.token,
                });

                console.log(`success soracom api to auth(). is set authHeader: `, this.authHeaders);
            })
            .catch(error => {
                console.error(`Error request Soracom Api from auth().`, error);
                throw error;
            });
    }

    async getSimData(simId: string): Promise<SoracomSimData> {
        if (this.authHeaders == null) {
            throw new Error(`SORACOM API is not authenticated.`);
        }

        let reqInitObj: RequestInit = {
            method: "GET",
            headers: this.authHeaders,
        }
        console.log(`soracom api to getSimData(). reqInitObj: `, reqInitObj);

        return await fetch(`${this.SORACOM_API_BASE_URI}/sims/${simId}`, reqInitObj)
            .then(async res => {
                if (!res.ok) {
                    console.error(res);
                    throw new Error('Failed request Soracom Api from getSimData().')
                }

                let body = await res.json();
                console.log(`soracom api to getSimData() success response. body: `, body);

                return {
                    simName: body.tags.name
                };
            })
            .catch(error => {
                console.error(`Error request Soracom Api from getSimData().`, error);
                throw error;
            });
    }
}


type LineGroupMessageObj = {
    simData: SoracomSimData,
    soracomReq: SoracomRequestObj,
    soracomEvent: SoracomEventObj,
};

class LineApi {
    private lineClient: messagingApi.MessagingApiClient;

    constructor(private token: string) {
        this.lineClient = new messagingApi.MessagingApiClient({
            channelAccessToken: token,
        });
    }

    async sendGroup(toGroup: string, messageObj: LineGroupMessageObj): Promise<void> {
        console.info(`request line messagingApi to sendGroup. toGroup: ${toGroup}, messageObj: ${JSON.stringify(messageObj, null, 4)}`);

        await this.lineClient.pushMessage({
            to: toGroup,
            messages: [
                { 
                    type: "text", 
                    text: `【罠名称】\n${messageObj.simData.simName}\n【バッテリー状況】\n${messageObj.soracomEvent.batteryLevel * 100}%\n【内容】\n罠が作動しました。\n確認してください。`
                },
                {
                    type: "location",
                    title: "罠の所在地",
                    address: "適当",
                    latitude: messageObj.soracomReq.location.lat,
                    longitude: messageObj.soracomReq.location.lon,
                }
            ]
        });
    }
}
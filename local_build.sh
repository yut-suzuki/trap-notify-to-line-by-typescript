docker build --provenance false --platform linux/amd64 -t trap-notify-to-line-by-typescript:latest .

# aws sso login --profile sso_work

# aws ecr get-login-password --region us-east-1 --profile sso_work | docker login --username AWS --password-stdin 841162704120.dkr.ecr.us-east-1.amazonaws.com

# docker run --platform linux/amd64 -p 9000:8080 --name trap-notify-to-line-by-typescript --env-file=./.env trap-notify-to-line-by-typescript:latest

# curl 'http://localhost:9000/2015-03-31/functions/function/invocations' \
#   -H 'accept: application/json' \
#   -d '{
#   "clickType": 1,
#   "clickTypeName": "SINGLE",
#   "batteryLevel": 1,
#   "binaryParserEnabled": true
# }'

# docker tag trap-notify-to-line-by-typescript:latest 841162704120.dkr.ecr.us-east-1.amazonaws.com/trap-notify-to-line-by-typescript:latest

# docker push 841162704120.dkr.ecr.us-east-1.amazonaws.com/trap-notify-to-line-by-typescript:latest

# aws lambda update-function-code \
#   --profile sso_work \
#   --function-name trapNotifyToLineByTypescript \
#   --image-uri 841162704120.dkr.ecr.us-east-1.amazonaws.com/trap-notify-to-line-by-typescript:latest \
#   --publish
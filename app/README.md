# BAW Fish

Frontend application which loads the Yolo model for inference.

## Convert YoloV5 to tfjs

To be able to use our trained model in the frontend, we need to convert it to tfjs format. This can be done by running the following command in the root directory of the project:

```bash
# cd to root project folder
python yolo/yolov5/export.py --weights yolo/content/current.pt  --include tfjs
cp -r yolo/content/current_web_model app/public/models/cell-counter
```

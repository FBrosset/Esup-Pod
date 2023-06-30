# pip3 install celery==5.2.7
# pip3 install webvtt-py
# pip3 install redis==4.5.4
from celery import Celery
from .Encoding_video import Encoding_video
from .importing_tasks import start_importing_task
import logging

# call local settings directly
# no need to load pod application to send statement
from .. import settings

logger = logging.getLogger(__name__)

ENCODING_TRANSCODING_CELERY_BROKER_URL = getattr(
    settings,
    "ENCODING_TRANSCODING_CELERY_BROKER_URL",
    ""
)

encoding_app = Celery(
    "encoding_tasks",
    broker=ENCODING_TRANSCODING_CELERY_BROKER_URL
)
encoding_app.conf.task_routes = {
    "pod.video_encode_transcript.encoding_tasks.*": {"queue": "encoding"}
}


# celery -A pod.video_encode_transcript.encoding_tasks worker -l INFO -Q encoding
@encoding_app.task
def start_encoding_task(video_id, video_path, cut_start, cut_end):
    """Start the encoding of the video."""
    print("Start the encoding of the video")
    print(video_id, video_path, cut_start, cut_end)
    encoding_video = Encoding_video(video_id, video_path, cut_start, cut_end)
    encoding_video.start_encode()
    print("End of the encoding of the video")
    start_importing_task.delay(
        encoding_video.start,
        video_id,
        video_path,
        cut_start,
        cut_end,
        encoding_video.stop
    )

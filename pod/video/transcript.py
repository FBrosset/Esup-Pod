from django.conf import settings
from django.core.files import File
from pod.completion.models import Track

from deepspeech import Model
import numpy as np
import shlex
import subprocess
# import sys
import glob
import os
import time
from timeit import default_timer as timer
from datetime import timedelta

from webvtt import WebVTT, Caption
from tempfile import NamedTemporaryFile

try:
    from shhlex import quote
except ImportError:
    from pipes import quote

import threading
import logging

DEBUG = getattr(settings, 'DEBUG', False)

if getattr(settings, 'USE_PODFILE', False):
    from pod.podfile.models import CustomFileModel
    from pod.podfile.models import UserFolder
    FILEPICKER = True
else:
    FILEPICKER = False
    from pod.main.models import CustomFileModel

DS_PARAM = getattr(settings, 'DS_PARAM', dict())
AUDIO_SPLIT_TIME = getattr(settings, 'AUDIO_SPLIT_TIME', 900)  # 5min
# time in sec for phrase length
SENTENCE_MAX_LENGTH = getattr(settings, 'SENTENCE_MAX_LENGTH', 3)

FFMPEG = getattr(settings, 'FFMPEG', 'ffmpeg')
FFMPEG_NB_THREADS = getattr(settings, 'FFMPEG_NB_THREADS', 0)
FFMPEG_MISC_PARAMS = getattr(
    settings, 'FFMPEG_MISC_PARAMS', " -hide_banner -y ")
# ffmpeg -i audio_192k.mp3 -acodec pcm_s16le -ac 1 -ar 16000 audio_192k.wav
# ffmpeg-normalize input.mp3 -c:a libmp3lame -b:a 320k -o output.mp3
ENCODE_WAV_CMD = getattr(
    settings, 'ENCODE_MP3_CMD',
    "%(ffmpeg_normalize)s %(source)s "
    + "-c:a pcm_s16le -b:a %(audio_bitrate)s "
    + "--target-level -23 -f -o "
    + "\"%(output_dir)s/audio_%(audio_bitrate)s.wav\"")
# SPLIT_WAV_CMD ffmpeg -i file.wav -f segment -segment_time 30 -c copy
SPLIT_WAV_CMD = getattr(
    settings, 'SPLIT_WAV_CMD',
    "%(ffmpeg)s -i %(source)s %(misc_params)s "
    + "-f segment -segment_time %(segment_time)s "
    + "-c copy -threads %(nb_threads)s "
    + "\"%(output_dir)s/splitaudio_%(audiod)s.wav\"")

MIN_SPLIT_DURATION = getattr(settings, 'MIN_SPLIT_DURATION', 20000)

log = logging.getLogger(__name__)


def start_transcript(video):
    log.info("START TRANSCRIPT VIDEO %s" % video)
    t = threading.Thread(target=main_threaded_transcript,
                         args=[video])
    t.setDaemon(True)
    t.start()


def main_threaded_transcript(video_to_encode):
    remove_encoding_in_progress = False
    if not video_to_encode.encoding_in_progress:
        remove_encoding_in_progress = True
        video_to_encode.encoding_in_progress = True
        video_to_encode.save()

    msg = main_transcript(video_to_encode)

    if DEBUG:
        print(msg)

    if remove_encoding_in_progress:
        video_to_encode.encoding_in_progress = False
        video_to_encode.save()


def convert_samplerate(audio_path, desired_sample_rate, trim_start, duration):
    # trim 0 1800
    # gain −n −3
    sox_cmd = 'sox {} --type raw --bits 16 --channels 1 --rate {} '.format(
        quote(audio_path), desired_sample_rate)
    sox_cmd += '--encoding signed-integer --endian little --compression 0.0 '
    sox_cmd += '--no-dither - trim {} {} '.format(trim_start, duration)

    try:
        output = subprocess.check_output(
            shlex.split(sox_cmd), stderr=subprocess.PIPE)

    except subprocess.CalledProcessError as e:
        raise RuntimeError('SoX returned non-zero status: {}'.format(e.stderr))
    except OSError as e:
        raise OSError(e.errno,
                      'SoX not found, use {}hz files or install it: {}'.format(
                          desired_sample_rate, e.strerror))

    return np.frombuffer(output, np.int16)


def check_file(path_file):
    if os.access(path_file, os.F_OK) and os.stat(path_file).st_size > 0:
        return True
    return False


def create_outputdir(video_id, video_path):
    dirname = os.path.dirname(video_path)
    output_dir = os.path.join(dirname, "%04d" % video_id)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    return output_dir


def encode_mp3_wav(source, output_dir, audio_bitrate):

    command = ENCODE_WAV_CMD % {
        'ffmpeg_normalize': 'ffmpeg-normalize',
        'source': source,
        'output_dir': output_dir,
        'audio_bitrate': audio_bitrate
    }

    msg = "\nffmpegWavCommand :\n%s" % command
    msg += "\n- Start Encoding Wav : %s" % time.ctime()
    # ffmpegaudio = subprocess.getoutput(command)
    ffmpegaudio = subprocess.run(
        command, shell=True, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT)
    if DEBUG:
        print(ffmpegaudio)
    msg += "\n- End Encoding WAV : %s" % time.ctime()

    audiofilename = output_dir + "/audio_%s.wav" % audio_bitrate
    if check_file(audiofilename):
        msg += "\n- encode_video_mp3 :\n%s" % audiofilename
    else:
        msg += "\n- encode_video_mp3 Wrong file or path %s " % audiofilename
        return '', msg

    return audiofilename, msg


def get_split_step(mp3file, video_to_encode, desired_sample_rate):
    # create wav file
    # ffmpeg -i audio_192k.mp3 -acodec pcm_s16le -ac 1 -ar 16000 audio_192k.wav
    output_dir = create_outputdir(
        video_to_encode.id, video_to_encode.video.path)
    waveFile, msgwav = encode_mp3_wav(
        mp3file.path, output_dir, desired_sample_rate)
    if waveFile == '':
        return [], waveFile, msgwav
    msgwav += "\n- Start split WAV : %s" % time.ctime()
    # split wav into multiple sub wav file
    command = SPLIT_WAV_CMD % {
        'ffmpeg': FFMPEG,
        'source': waveFile,
        'nb_threads': FFMPEG_NB_THREADS,
        'misc_params': FFMPEG_MISC_PARAMS,
        'segment_time': AUDIO_SPLIT_TIME,
        'output_dir': output_dir,
        'audiod': '%09d'
    }
    ffmpegaudio = subprocess.run(
        command, shell=True, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT)
    print(ffmpegaudio) if DEBUG else ''
    msgwav += "\n- End split WAV : %s" % time.ctime()
    split_step = []
    start_step = 0
    from pydub import AudioSegment, silence
    for file in sorted(glob.glob(output_dir + "/splitaudio_*.wav")):
        print("###" * 40) if DEBUG else ''
        print("create audio segment : %s" % file) if DEBUG else ''
        myaudio = AudioSegment.from_wav(file)
        print("detect_silence silence_thresh : %s" %
              myaudio.dBFS) if DEBUG else ''
        allsilences = silence.detect_silence(
            myaudio, min_silence_len=500, silence_thresh=myaudio.dBFS - 16)
        print("allsilences :\n %s \n" % allsilences) if DEBUG else ''
        start_trim = 0
        if len(allsilences) > 0:
            for sil in allsilences:
                if sil[0] > start_trim + MIN_SPLIT_DURATION:
                    split_step.append(
                        [
                            start_step + (start_trim / 1000),
                            start_step + (sil[0] / 1000)
                        ]
                    )
                    start_trim = sil[0]
            split_step.append([start_step + start_trim / 1000,
                               start_step + myaudio.duration_seconds])
        else:
            for i in range(
                    MIN_SPLIT_DURATION,
                    int(myaudio.duration_seconds) * 1000,
                    MIN_SPLIT_DURATION):
                split_step.append(
                    [
                        start_step + (start_trim / 1000),
                        start_step + (i / 1000)
                    ]
                )
                start_trim = i
            split_step.append([start_step + start_trim / 1000,
                               start_step + myaudio.duration_seconds])
        start_step += myaudio.duration_seconds
        print(split_step) if DEBUG else ''
        print("-_-" * 40) if DEBUG else ''
        # remove file
        os.remove(file)
    print(split_step) if DEBUG else ''
    return split_step, waveFile, msgwav

# #################################
# TRANSCRIPT VIDEO : MAIN FUNCTION
# #################################


def main_transcript(video_to_encode):
    msg = ""

    mp3file = video_to_encode.get_video_mp3(
    ).source_file if video_to_encode.get_video_mp3() else None

    lang = video_to_encode.main_lang

    # check if DS_PARAM [lang] exist
    if not DS_PARAM.get(lang):
        msg += "\n no deepspeech model found for lang:%s." % lang
        msg += "Please add it in DS_PARAM."
        return msg

    ds_model = Model(
        DS_PARAM[lang]['model'], DS_PARAM[lang]['beam_width']
    )

    if all([cond in DS_PARAM[lang]
            for cond in ['alphabet', 'lm', 'trie',
                         'lm_alpha', 'lm_beta']]):
        ds_model.enableDecoderWithLM(
            DS_PARAM[lang]['lm'], DS_PARAM[lang]['trie'],
            DS_PARAM[lang]['lm_alpha'], DS_PARAM[lang]['lm_beta']
        )

    desired_sample_rate = ds_model.sampleRate()

    webvtt = WebVTT()
    inference_start = timer()
    # last_item = None
    sentences = []
    sentence = []
    metadata = None

    split_step, waveFile, msgwav = get_split_step(
        mp3file, video_to_encode, desired_sample_rate)
    msg += msgwav
    if waveFile == '':
        return msg

    for step in split_step:

        start_trim = step[0]
        end_trim = step[1]
        duration = end_trim - start_trim

        step_msg = "\ntake audio from %s to %s - %s" % (
            start_trim, end_trim, duration)
        print(step_msg) if DEBUG else ''
        msg += step_msg

        audio = convert_samplerate(
            waveFile, desired_sample_rate, start_trim, duration)

        step_msg = '\nRunning inference.'
        print(step_msg) if DEBUG else ''
        msg += step_msg

        metadata = ds_model.sttWithMetadata(audio)

        step_msg = '\nConfidence : %s' % metadata.confidence
        print(step_msg) if DEBUG else ''
        msg += step_msg

        sentences[:] = []  # empty list
        sentence[:] = []  # empty list

        # nb of character in AUDIO_SPLIT_TIME
        step_msg = "\nMETADATA ITEMS : %d " % len(metadata.items)
        print(step_msg) if DEBUG else ''
        msg += step_msg

        sentences = get_sentences(metadata) if len(metadata.items) > 0 else []

        step_msg = "\nNB SENTENCES : %d " % len(sentences)
        print(step_msg) if DEBUG else ''
        msg += step_msg

        for sent in sentences:
            if len(sent) > 0:
                start_time = sent[0].start_time + start_trim
                end_time = sent[-1].start_time + start_trim
                str_sentence = ''.join(item.character for item in sent)
                print(start_time, end_time, str_sentence)
                caption = Caption(
                    '%s.%s' % (timedelta(
                        seconds=int(str(start_time).split('.')[0])),
                        str('%.3f' % start_time).split('.')[1]),
                    '%s.%s' % (timedelta(
                        seconds=int(str(end_time).split('.')[0])),
                        str('%.3f' % end_time).split('.')[1]),
                    ['%s' % str_sentence]
                )
                webvtt.captions.append(caption)
    # remove waveFile
    os.remove(waveFile) if os.path.isfile(waveFile) else ''

    msg += saveVTT(video_to_encode, webvtt)
    inference_end = timer() - inference_start
    msg += '\nInference took %0.3fs.' % inference_end
    print(msg) if DEBUG else ''

    return msg


def get_sentences(metadata):
    sentence = []
    sentences = []
    refItem = metadata.items[0]
    index = 0
    for item in metadata.items[index:]:
        if((item.start_time - refItem.start_time) < SENTENCE_MAX_LENGTH):
            sentence.append(item)
        else:
            if item.character == ' ':
                sentences.append(sentence)
                sentence = []
                refItem = item
            else:
                sentence.append(item)
    if sentence != []:
        sentences.append(sentence)
    return sentences


def get_index(metadata, last_item, start_trim):
    """
    try:
        index = metadata.items.index(last_item) if last_item else 0
        refItem = metadata.items[index]
    except ValueError:
        print("Last item not found")
    """
    index = 0
    for item in metadata.items:
        if (
                (item.character == last_item[0]) and
                (item.start_time > (last_item[1] - start_trim))
        ):
            return index + 1  # take the next one
        else:
            index += 1
    return 0


def saveVTT(video, webvtt):
    msg = "\nSAVE TRANSCRIPT WEBVTT : %s" % time.ctime()
    lang = video.main_lang
    temp_vtt_file = NamedTemporaryFile(suffix='.vtt')
    webvtt.save(temp_vtt_file.name)
    if webvtt.captions:
        msg += "\nstore vtt file in bdd with CustomFileModel model file field"
        if FILEPICKER:
            videodir, created = UserFolder.objects.get_or_create(
                name='%s' % video.slug,
                owner=video.owner)
            """
            previousSubtitleFile = CustomFileModel.objects.filter(
                name__startswith="subtitle_%s" % lang,
                folder=videodir,
                created_by=video.owner
            )
            """
            # for subt in previousSubtitleFile:
            #     subt.delete()
            subtitleFile, created = CustomFileModel.objects.get_or_create(
                name="subtitle_%s_%s" % (lang, time.strftime("%Y%m%d-%H%M%S")),
                folder=videodir,
                created_by=video.owner)
            if subtitleFile.file and os.path.isfile(subtitleFile.file.path):
                os.remove(subtitleFile.file.path)
        else:
            subtitleFile, created = CustomFileModel.objects.get_or_create()

        subtitleFile.file.save("subtitle_%s_%s.vtt" % (
            lang, time.strftime("%Y%m%d-%H%M%S")), File(temp_vtt_file))
        msg += "\nstore vtt file in bdd with Track model src field"

        subtitleVtt, created = Track.objects.get_or_create(
            video=video, lang=lang)
        subtitleVtt.src = subtitleFile
        subtitleVtt.lang = lang
        subtitleVtt.save()
    else:
        msg += "\nERROR SUBTITLES Output size is 0"
    return msg

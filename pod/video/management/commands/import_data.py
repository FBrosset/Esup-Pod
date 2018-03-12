from django.utils import translation
from django.core.management.base import BaseCommand
from django.core import serializers
from django.conf import settings
from pod.authentication.models import Owner
import os

BASE_DIR = getattr(
    settings, 'BASE_DIR', '/home/pod/django_projects/podv2/pod')


class Command(BaseCommand):
    args = 'Channel Theme Type User Discipline'
    help = 'Import from V1'
    valid_args = ['Channel', 'Theme', 'Type', 'User', 'Discipline', 'FlatPage',
                  'UserProfile']

    def add_arguments(self, parser):
        parser.add_argument('import')

    def handle(self, *args, **options):
        # Activate a fixed locale fr
        translation.activate('fr')
        print(BASE_DIR)
        if options['import'] and options['import'] in self.valid_args:
            type_to_import = options['import']
            filepath = os.path.join(BASE_DIR, '../../import/',
                                    type_to_import + ".json")
            self.migrate_to_v2(filepath, type_to_import)
            with open(filepath, "r") as infile:
                data = serializers.deserialize("json", infile)
                for obj in data:
                    if type_to_import == 'UserProfile':
                        owner = Owner.objects.get(user_id=obj.object.user_id)
                        owner.auth_type = obj.object.auth_type
                        owner.affiliation = obj.object.affiliation
                        owner.commentaire = obj.object.commentaire
                        #todo image
                        owner.save()
                    else:
                        obj.save()
        else:
            print(
                "******* Warning: you must give some arguments: %s *******"
                % self.args)

    def migrate_to_v2(self, filepath, type_to_import):
        f = open(filepath, 'r')
        filedata = f.read()
        f.close()
        newdata = ""
        if type_to_import == 'Channel':
            newdata = filedata.replace("pods.channel", "video.channel")
        if type_to_import == 'Theme':
            newdata = filedata.replace("pods.theme", "video.theme")
        if type_to_import == 'Type':
            newdata = filedata.replace("pods.type", "video.type")
            newdata = newdata.replace("headband", "icon")
        if type_to_import == 'User':
            newdata = filedata.replace("", "")
        if type_to_import == 'FlatPage':
            newdata = filedata.replace("", "")
        if type_to_import == 'Discipline':
            newdata = filedata.replace(
                "pods.discipline", "video.discipline")
            newdata = newdata.replace("headband", "icon")
        if type_to_import == 'UserProfile':
            newdata = filedata.replace(
                "core.userprofile", "authentication.owner"
            )
            newdata = newdata.replace("\"image\":", "\"userpicture\":")
        f = open(filepath, 'w')
        f.write(newdata)
        f.close()
"""
SAVE FROM PODV1

from pods.models import Channel
from pods.models import Theme
from pods.models import Type
from pods.models import User
from pods.models import Discipline
from django.core import serializers
from django.contrib.flatpages.models import FlatPage

jsonserializer = serializers.get_serializer("json")
json_serailizer = jsonserializer()

with open("Channel.json", "w") as out:
    json_serailizer.serialize(Channel.objects.all(), stream=out)

with open("Theme.json", "w") as out:
    json_serailizer.serialize(Theme.objects.all(), stream=out)

with open("Type.json", "w") as out:
    json_serailizer.serialize(Type.objects.all(), stream=out)

with open("User.json", "w") as out:
    json_serailizer.serialize(User.objects.all(), stream=out)

with open("Discipline.json", "w") as out:
    json_serailizer.serialize(Discipline.objects.all(), stream=out)

with open("FlatPage.json", "w") as out:
    json_serailizer.serialize(FlatPage.objects.all(), stream=out)

from core.models import UserProfile
with open("UserProfile.json", "w") as out:
    json_serailizer.serialize(UserProfile.objects.all(), stream=out, fields=('user','auth_type', 'affiliation', 'commentaire', 'image'))

"""

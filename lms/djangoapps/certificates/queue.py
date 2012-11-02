from certificates.models import GeneratedCertificate
from certificates.models import certificate_status_for_student
from certificates.models import CertificateStatuses as status

from courseware import grades, courses
from django.test.client import RequestFactory
from capa.xqueue_interface import XQueueInterface
from capa.xqueue_interface import make_xheader, make_hashkey
from django.conf import settings
from requests.auth import HTTPBasicAuth
from student.models import UserProfile

import json
import random
import logging


logger = logging.getLogger(__name__)


class XQueueCertInterface(object):
    """
    XQueueCertificateInterface provides an
    interface to the xqueue server for
    managing student certificates.

    Instantiating an object will create a new
    connection to the queue server.

    See models.py for valid state transitions,
    summary of methods:

       add_cert:   Add a new certificate.  Puts a single
                   request on the queue for the student/course.
                   Once the certificate is generated a post
                   will be made to the update_certificate
                   view which will save the certificate
                   download URL.

       regen_cert: Regenerate an existing certificate.
                   For a user that already has a certificate
                   this will delete the existing one and
                   generate a new cert.


       del_cert:   Delete an existing certificate
                   For a user that already has a certificate
                   this will delete his cert.

    """

    def __init__(self, request=None):

        # Get basic auth (username/password) for
        # xqueue connection if it's in the settings

        if settings.XQUEUE_INTERFACE.get('basic_auth') is not None:
            requests_auth = HTTPBasicAuth(
                    *settings.XQUEUE_INTERFACE['basic_auth'])
        else:
            requests_auth = None

        if request is None:
            factory = RequestFactory()
            self.request = factory.get('/')
        else:
            self.request = request

        self.xqueue_interface = XQueueInterface(
                settings.XQUEUE_INTERFACE['url'],
                settings.XQUEUE_INTERFACE['django_auth'],
                requests_auth,
                )

    def regen_cert(self, student, course_id):
        """
        Arguments:
          student - User.object
          course_id - courseenrollment.course_id (string)

        Removes certificate for a student, will change
        the certificate status to 'regenerating'.

        Certificate must be in the 'error' or 'downloadable' state
        and the student must have a passing grade.

        otherwise it will return the current state

        """

        VALID_STATUSES = [status.error, status.downloadable]

        cert_status = certificate_status_for_student(
                              student, course_id)['status']

        if cert_status in VALID_STATUSES:
            # grade the student
            course = courses.get_course_by_id(course_id)
            grade = grades.grade(student, self.request, course)

            if grade['grade'] is not None:

                profile = UserProfile.objects.get(user=student)
                try:
                    cert = GeneratedCertificate.objects.get(
                        user=student, course_id=course_id)
                except GeneratedCertificate.DoesNotExist:
                    logger.warning("Attempting to regenerate a certificate"
                                   "for a user that doesn't have one")
                    raise

                cert.status = status.regenerating
                cert.name = profile.name

                contents = {
                     'action': 'regen',
                     'remove_verify_uuid': cert.verify_uuid,
                     'remove_download_uuid': cert.download_uuid,
                     'username': cert.user.username,
                     'course_id': cert.course_id,
                     'name': profile.name,
                    }

                key = cert.key
                self.__send_to_xqueue(contents, key)
                cert.save()

        return cert_status

    def del_cert(self, student, course_id):

        """
        Arguments:
          student - User.object
          course_id - courseenrollment.course_id (string)

        Removes certificate for a student, will change
        the certificate status to 'deleting'.

        Certificate must be in the 'error' or 'downloadable' state
        otherwise it will return the current state

        """

        VALID_STATUSES = [status.error, status.downloadable]

        cert_status = certificate_status_for_student(
                              student, course_id)['status']

        if cert_status in VALID_STATUSES:

            try:
                cert = GeneratedCertificate.objects.get(
                    user=student, course_id=course_id)
            except GeneratedCertificate.DoesNotExist:
                logger.warning("Attempting to delete a certificate"
                               "for a user that doesn't have one")
                raise

            cert.status = status.deleting

            contents = {
                 'action': 'remove',
                 'remove_verify_uuid': cert.verify_uuid,
                 'remove_download_uuid': cert.download_uuid,
                 'username': cert.user.username,
            }

            key = cert.key
            self.__send_to_xqueue(contents, key)
            cert.save()
        return cert_status

    def add_cert(self, student, course_id):
        """

        Arguments:
          student - User.object
          course_id - courseenrollment.course_id (string)

        Request a new certificate for a student.
        Will change the certificate status to 'deleting'.

        Certificate must be in the 'unavailable', 'error',
        or 'deleted' state and the student must have
        a passing grade.

        otherwise it will return the current state

        """

        VALID_STATUSES = [status.unavailable, status.deleted, status.error]

        cert_status = certificate_status_for_student(
                              student, course_id)['status']

        if cert_status in VALID_STATUSES:
            # grade the student
            course = courses.get_course_by_id(course_id)
            grade = grades.grade(student, self.request, course)

            if grade['grade'] is not None:
                cert_status = status.generating
                cert, created = GeneratedCertificate.objects.get_or_create(
                       user=student, course_id=course_id)
                profile = UserProfile.objects.get(user=student)

                key = make_hashkey(random.random())
                cert.status = cert_status
                cert.grade = grade['percent']
                cert.user = student
                cert.course_id = course_id
                cert.key = key
                cert.name = profile.name

                contents = {
                    'action': 'create',
                    'username': student.username,
                    'course_id': course_id,
                    'name': profile.name,
                }

                self.__send_to_xqueue(contents, key)
                cert.save()

        return cert_status

    def __send_to_xqueue(self, contents, key):

        # TODO - need to read queue name from settings

        xheader = make_xheader(
            'http://{0}/update_certificate?{1}'.format(
                key, settings.SITE_NAME), key, 'test-pull')

        (error, msg) = self.xqueue_interface.send_to_queue(
                header=xheader, body=json.dumps(contents))
        if error:
            logger.critical('Unable to add a request to the queue')
            raise Exception('Unable to send queue message')
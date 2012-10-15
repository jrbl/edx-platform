var $body;
var $modal;
var $modalCover;
var $newComponentItem;
var $newComponentStep1;
var $newComponentStep2;

$(document).ready(function() {
    $body = $('body');
    $modal = $('.history-modal');
    $modalCover = $('.modal-cover');
    $newComponentItem = $('.new-component-item');
    $newComponentTypePicker = $('.new-component');
    $newComponentTemplatePickers = $('.new-component-templates');
    $newComponentButton = $('.new-component-button');
    $body.bind('keyup', onKeyUp);

    $('.expand-collapse-icon').bind('click', toggleSubmodules);
    $('.visibility-options').bind('change', setVisibility);

    $('.unit-history ol a').bind('click', showHistoryModal);
    $modal.bind('click', hideModal);
    $modalCover.bind('click', hideHistoryModal);
    $('.assets .upload-button').bind('click', showUploadModal);
    $('.upload-modal .close-button').bind('click', hideModal);

    $('a.show-xml').toggle(showEmbeddableXML, hideEmbeddableXML);

    $('a.copy-button').toggle(showEmbeddableXML, hideEmbeddableXML);
    $('.unit .item-actions .delete-button').bind('click', deleteUnit);
    $('.new-unit-item').bind('click', createNewUnit);
    $('.save-subsection').bind('click', saveSubsection);

    // making the unit list sortable
    $('.sortable-unit-list').sortable({
        axis: 'y',
        handle: '.drag-handle',
        update: onUnitReordered
    });

    // expand/collapse methods for optional date setters
    $('.set-date').bind('click', showDateSetter);
    $('.remove-date').bind('click', removeDateSetter);
    // add new/delete section
    $('.new-courseware-section-button').bind('click', addNewSection);
    $('.delete-section-button').bind('click', deleteSection);
    
    // add new/delete subsection
    $('.new-subsection-item').bind('click', addNewSubsection);
    $('.delete-subsection-button').bind('click', deleteSubsection);
    // add/remove policy metadata button click handlers
    $('.add-policy-data').bind('click', addPolicyMetadata);
    $('.remove-policy-data').bind('click', removePolicyMetadata);

    $('.sync-date').bind('click', syncReleaseDate);

    // import form setup
    $('.import .file-input').bind('change', showImportSubmit);
    $('.import .choose-file-button, .import .choose-file-button-inline').bind('click', function(e) {
        e.preventDefault();
        $('.import .file-input').click();
    });

    // Subsection reordering
    $('.unit-list ol').sortable({
        axis: 'y',
        handle: '.section-item .drag-handle',
        update: onSubsectionReordered
    });

    // Section reordering
    $('.courseware-overview').sortable({
        axis: 'y',
        handle: 'header .drag-handle',
        update: onSectionReordered
    });

    $('.new-course-button').bind('click', addNewCourse);

});

function showImportSubmit(e) {
    $('.file-name').html($(this).val())
    $('.file-name-block').show();
    $('.import .choose-file-button').hide();
    $('.submit-button').show();
    $('.progress').show();
}

function syncReleaseDate(e) {
    e.preventDefault();
    $("#start_date").val("");
    $("#start_time").val("");
}

function addPolicyMetadata(e) {
    e.preventDefault();
    var template =$('#add-new-policy-element-template > li'); 
    var newNode = template.clone();
    var _parent_el = $(this).parent('ol:.policy-list');
    newNode.insertBefore('.add-policy-data');
    $('.remove-policy-data').bind('click', removePolicyMetadata);
}

function removePolicyMetadata(e) {
    e.preventDefault();
    policy_name = $(this).data('policy-name');
    var _parent_el = $(this).parent('li:.policy-list-element');
    if ($(_parent_el).hasClass("new-policy-list-element"))
        _parent_el.remove();
    else
        _parent_el.appendTo("#policy-to-delete");
}

function showEmbeddableXML(e) {
    $ceiling = $(this).parents('tr');
    if ($ceiling.length === 0) $ceiling = $(this).parents('.upload-modal');
    $ceiling.find('.embeddable-xml').html('&lt;img src="'+$(this).attr('href')+'"/&gt;');
}
function hideEmbeddableXML(e) {
    $ceiling = $(this).parents('tr');
    console.log($ceiling.length)
    if ($ceiling.length === 0) $ceiling = $(this).parents('.upload-modal');
    $ceiling.find('.embeddable-xml').html("");
}


// This method only changes the ordering of the child objects in a subsection
function onUnitReordered() {
    var subsection_id = $(this).data('subsection-id');

    var _els = $(this).children('li:.leaf');
    var children = _els.map(function(idx, el) { return $(el).data('id'); }).get();

    // call into server to commit the new order
    $.ajax({
	    url: "/save_item",
		type: "POST",
		dataType: "json",
		contentType: "application/json",
		data:JSON.stringify({ 'id' : subsection_id, 'metadata' : null, 'data': null, 'children' : children})
	});
}

function onSubsectionReordered() {
    var section_id = $(this).data('section-id');

    var _els = $(this).children('li:.branch');
    var children = _els.map(function(idx, el) { return $(el).data('id'); }).get();

    // call into server to commit the new order
    $.ajax({
        url: "/save_item",
        type: "POST",
        dataType: "json",
        contentType: "application/json",
        data:JSON.stringify({ 'id' : section_id, 'metadata' : null, 'data': null, 'children' : children})
    });
}

function onSectionReordered() {
    var course_id = $(this).data('course-id');

    var _els = $(this).children('section:.branch');
    var children = _els.map(function(idx, el) { return $(el).data('id'); }).get();

    // call into server to commit the new order
    $.ajax({
        url: "/save_item",
        type: "POST",
        dataType: "json",
        contentType: "application/json",
        data:JSON.stringify({ 'id' : course_id, 'metadata' : null, 'data': null, 'children' : children})
    });
}

function getEdxTimeFromDateTimeInputs(date_id, time_id, format) {
    var input_date = $('#'+date_id).val();
    var input_time = $('#'+time_id).val();

    var edxTimeStr = null;

    if (input_date != '') {
        if (input_time == '') 
            input_time = '00:00';

        // Note, we are using date.js utility which has better parsing abilities than the built in JS date parsing
        date = Date.parse(input_date+" "+input_time);
        if (format == null)
            format = 'yyyy-MM-ddTHH:mm';

        edxTimeStr = date.toString(format);
    }

    return edxTimeStr;
}

function saveSubsection(e) {
    e.preventDefault();
    
    var id = $(this).data('id');

    // pull all 'normalized' metadata editable fields on page
    var metadata_fields = $('input[data-metadata-name]');
    
    metadata = {};
    for(var i=0; i< metadata_fields.length;i++) {
	   el = metadata_fields[i];
	   metadata[$(el).data("metadata-name")] = el.value;
    } 

    // now add 'free-formed' metadata which are presented to the user as dual input fields (name/value)
    $('ol.policy-list > li.policy-list-element').each( function(i, element) {
        name = $(element).children('.policy-list-name').val();
        val = $(element).children('.policy-list-value').val();
        metadata[name] = val;
    });

    // now add any 'removed' policy metadata which is stored in a separate hidden div
    // 'null' presented to the server means 'remove'
    $("#policy-to-delete > li.policy-list-element").each(function(i, element) {
        name = $(element).children('.policy-list-name').val();
        if (name != "")
           metadata[name] = null;
    });

    // Piece back together the date/time UI elements into one date/time string
    // NOTE: our various "date/time" metadata elements don't always utilize the same formatting string
    // so make sure we're passing back the correct format
    metadata['start'] = getEdxTimeFromDateTimeInputs('start_date', 'start_time');
    metadata['due'] = getEdxTimeFromDateTimeInputs('due_date', 'due_time', 'MMMM dd HH:mm');

    // reordering is done through immediate callbacks when the resorting has completed in the UI
    children =[];

    $.ajax({
	    url: "/save_item",
		type: "POST",
		dataType: "json",
		contentType: "application/json",
		data:JSON.stringify({ 'id' : id, 'metadata' : metadata, 'data': null, 'children' : children}),
		success: function() {
		alert('Your changes have been saved.');
	    },
		error: function() {
		alert('There has been an error while saving your changes.');
	    }
	});
}


function createNewUnit(e) {
    e.preventDefault();

    parent = $(this).data('parent');
    template = $(this).data('template');

    $.post('/clone_item',
	   {'parent_location' : parent,
		   'template' : template,
		   'display_name': 'New Unit',
		   },
	   function(data) {
	       // redirect to the edit page
	       window.location = "/edit/" + data['id'];
	   });
}

function deleteUnit(e) {
    e.preventDefault();
    _deleteItem($(this).parents('li.leaf'));
}

function deleteSubsection(e) {
    e.preventDefault();
    _deleteItem($(this).parents('li.branch'));
}

function deleteSection(e) {
    e.preventDefault();
    _deleteItem($(this).parents('section.branch'));
}

function _deleteItem($el) {
     if(!confirm('Are you sure you wish to delete this item. It cannot be reversed!'))
       return;
          
    var id = $el.data('id');
    
    $.post('/delete_item', 
       {'id': id, 'delete_children' : true, 'delete_all_versions' : true}, 
       function(data) {
           $el.remove();
       });
}

function showUploadModal(e) {
    e.preventDefault();
    $('.upload-modal').show();
    $('.file-input').bind('change', startUpload);
    $('.upload-modal .choose-file-button').bind('click', showFileSelectionMenu);
    $modalCover.show();
}

function showFileSelectionMenu(e) {
    e.preventDefault();
    $('.file-input').click();
}

function startUpload(e) {
    $('.upload-modal h1').html('Uploading…');
    $('.upload-modal .file-name').html($('.file-input').val());
    $('.upload-modal .file-chooser').ajaxSubmit({
        beforeSend: resetUploadBar,
        uploadProgress: showUploadFeedback,
        complete: displayFinishedUpload
    });
    $('.upload-modal .choose-file-button').hide();
    $('.upload-modal .progress-bar').removeClass('loaded').show();
}

function resetUploadBar(){
    var percentVal = '0%';
    $('.upload-modal .progress-fill').width(percentVal)
    $('.upload-modal .progress-fill').html(percentVal);
}

function showUploadFeedback(event, position, total, percentComplete) {
    var percentVal = percentComplete + '%';
    $('.upload-modal .progress-fill').width(percentVal);
    $('.upload-modal .progress-fill').html(percentVal);
}

function displayFinishedUpload(xhr) {
    if(xhr.status = 200){
        markAsLoaded();
    }
    $('.upload-modal .copy-button').attr('href', xhr.getResponseHeader('asset_url'));
    $('.upload-modal .progress-fill').html(xhr.responseText);
    $('.upload-modal .choose-file-button').html('Load Another File').show();
}

function markAsLoaded() {
    $('.upload-modal .copy-button').css('display', 'inline-block');
    $('.upload-modal .progress-bar').addClass('loaded');
}    

function hideModal(e) {
    e.preventDefault();
    $('.modal').hide();
    $modalCover.hide();
}

function onKeyUp(e) {
    if(e.which == 87) {
        $body.toggleClass('show-wip hide-wip');
    }
}

function toggleSubmodules(e) {
    e.preventDefault();
    $(this).toggleClass('expand').toggleClass('collapse');
    $(this).closest('.branch, .window').toggleClass('collapsed');
}

function setVisibility(e) {
    $(this).find('.checked').removeClass('checked');
    $(e.target).closest('.option').addClass('checked');
}

function editComponent(e) {
    e.preventDefault();
    $(this).closest('.xmodule_edit').addClass('editing').find('.component-editor').slideDown(150);
}

function closeComponentEditor(e) {
    e.preventDefault();
    $(this).closest('.xmodule_edit').removeClass('editing').find('.component-editor').slideUp(150);
}


function showHistoryModal(e) {
    e.preventDefault();

    $modal.show();
    $modalCover.show();
}

function hideHistoryModal(e) {
    e.preventDefault();

    $modal.hide();
    $modalCover.hide();
}

function showDateSetter(e) {
    e.preventDefault();
    var $block = $(this).closest('.due-date-input');
    $(this).hide();
    $block.find('.date-setter').show();
}

function removeDateSetter(e) {
    e.preventDefault();
    var $block = $(this).closest('.due-date-input');
    $block.find('.date-setter').hide();
    $block.find('.set-date').show();
    // clear out the values
    $block.find('.date').val('');
    $block.find('.time').val('');
}

function showToastMessage(message, $button, lifespan) {
    var $toast = $('<div class="toast-notification"></div>');
    var $closeBtn = $('<a href="#" class="close-button">×</a>');
    $toast.append($closeBtn);
    var $content = $('<div class="notification-content"></div>');
    $content.html(message);
    $toast.append($content);
    if($button) {
        $button.addClass('action-button');
        $button.bind('click', hideToastMessage);
        $content.append($button);
    }
    $closeBtn.bind('click', hideToastMessage);

    if($('.toast-notification')[0]) {
        var targetY = $('.toast-notification').offset().top + $('.toast-notification').outerHeight();
        $toast.css('top', (targetY + 10) + 'px');
    }

    $body.prepend($toast);
    $toast.fadeIn(200);

    if(lifespan) {
        $toast.timer = setTimeout(function() {
            $toast.fadeOut(300);
        }, lifespan * 1000);
    }
}

function hideToastMessage(e) {
    e.preventDefault();
    $(this).closest('.toast-notification').remove();
}

function addNewSection(e) {
    e.preventDefault();
    var $newSection = $($('#new-section-template').html());
    $('.new-courseware-section-button').after($newSection);
    $newSection.find('.new-section-name').focus().select();
    $newSection.find('.new-section-name-save').bind('click', saveNewSection);
    $newSection.find('.new-section-name-cancel').bind('click', cancelNewSection);
}


function saveNewSection(e) {
    e.preventDefault();

    parent = $(this).data('parent');
    template = $(this).data('template');

    display_name = $(this).prev('.new-section-name').val();

    $.post('/clone_item',
       {'parent_location' : parent,
           'template' : template,
           'display_name': display_name,
           },
       function(data) {
            if (data.id != undefined)
               location.reload();
       });    
}

function cancelNewSection(e) {
    e.preventDefault();
    $(this).parents('section.new-section').remove();
}


function addNewCourse(e) {
    e.preventDefault();
    var $newCourse = $($('#new-course-template').html());
    $('.new-course-button').after($newCourse);
    $newCourse.find('.new-course-org').focus().select();
    $newCourse.find('.new-course-save').bind('click', saveNewCourse);
    $newCourse.find('.new-course-cancel').bind('click', cancelNewCourse);
}

function saveNewCourse(e) {
    e.preventDefault();

    var $newCourse = $(this).closest('.new-course');

    template = $(this).data('template');

    org = $newCourse.find('.new-course-org').val();
    number = $newCourse.find('.new-course-number').val();
    display_name = $newCourse.find('.new-course-name').val();

    if (org == '' || number == '' || display_name == ''){
        alert('You must specify all fields in order to create a new course.');
        return;
    }

    $.post('/create_new_course',
       { 'template' : template,
           'org' : org,
           'number' : number,
           'display_name': display_name,
           },
       function(data) {
            if (data.id != undefined)
               location.reload(); 
            else if (data.ErrMsg != undefined)
                alert(data.ErrMsg);
       });    
}

function cancelNewCourse(e) {
    e.preventDefault();
    $(this).parents('section.new-course').remove();
}

function addNewSubsection(e) {
    e.preventDefault();
    var $section = $(this).closest('.courseware-section');
    var $newSubsection = $($('#new-subsection-template').html());
    $section.find('.unit-list > ol').append($newSubsection);
    $section.find('.new-subsection-name-input').focus().select();

    var $saveButton = $newSubsection.find('.new-subsection-name-save');
    $saveButton.bind('click', saveNewSubsection);

    parent = $(this).parents("section.branch").data("id");

    $saveButton.data('parent', parent)
    $saveButton.data('template', $(this).data('template'));

    $newSubsection.find('.new-subsection-name-cancel').bind('click', cancelNewSubsection);    
}

function saveNewSubsection(e) {
    e.preventDefault();

    parent = $(this).data('parent');
    template = $(this).data('template');


    display_name = $(this).prev('.subsection-name').find('.new-subsection-name-input').val()

    $.post('/clone_item',
       {'parent_location' : parent,
           'template' : template,
           'display_name': display_name,
           },
       function(data) {
            if (data.id != undefined) {
                location.reload();             
            }
       });  

            
}

function cancelNewSubsection(e) {
    e.preventDefault();
    $(this).parents('li.branch').remove();
}
// podfile:filewidjet.js
// select file

if (typeof loaded == "undefined") {
  console.log("%c filewidget.js loaded", "color : #bada55");
  loaded = true;
  document.addEventListener("click", (e) => {
    if (
      !e.target.parentNode.matches(".file-name") &&
      !e.target.parentNode.matches(".file-image")
    )
      return;
    let file = e.target.parentNode;
    e.preventDefault();
    if (id_input && id_input != "") {
      document.querySelector("input#" + id_input).value = file.dataset.fileid;

      if (file.dataset.filetype == "CustomImageModel") {
        document.querySelector(".btn-fileinput_" + id_input).innerHTML =
          gettext("Change image");
      } else {
        document.querySelector(".btn-fileinput_" + id_input).innerHTML =
          gettext("Change file");
      }
      //
      //if($(".btn-fileinput_"+id_input).text().indexOf(gettext('Change file')) != -1 || $(".btn-fileinput_"+id_input).text().indexOf(gettext('Select a file')) != -1)
      //    $(".btn-fileinput_"+id_input).html(gettext('Change file'));
      //else $(".btn-fileinput_"+id_input).html(gettext('Change image'));
      //
      document.querySelector("#remove_file_" + id_input).style.display =
        "block";

      let html = "";
      if (file.dataset.filetype == "CustomImageModel") {
        html +=
          '<img src="' +
          file.getAttribute("href") +
          '" height="34" alt="' +
          file.getAttribute("title") +
          '" loading="lazy"/>&nbsp;';
      } else {
        html +=
          '<img style="height: 26px;vertical-align: middle;" src="' +
          static_url +
          'podfile/images/icons/default.svg" alt="" loading="lazy">&nbsp;';
      }
      html +=
        '<strong><a href="' +
        file.getAttribute("href") +
        '" target="_blank" title="' +
        gettext("Open file in a new tab") +
        '">' +
        file.getAttribute("title") +
        "</a></strong>&nbsp;";
      document.querySelector("#fileinput_" + id_input).innerHTML = html;

      document.querySelector("#modal-folder_" + id_input).innerHTML = "";

      let modalFile = bootstrap.Modal.getInstance(
        document.querySelector("#fileModal_" + id_input)
      );
      modalFile.hide();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.matches("a.folder")) return;

    e.preventDefault();
    document
      .querySelectorAll("#podfile #list_folders_sub a.folder-opened")
      .forEach((el) => {
        el.classList.remove("folder-opened");
      });
    e.target.classList.add("folder-opened");
    document.getElementById("files").classList.add("loading");
    var id = e.target.dataset.id;
    let loader = `
       <div class="container-loader">
           <div class="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
       </div>
       `;
    document.getElementById("files").innerHTML = loader;
    let success_func = function ($data) {
      $data = JSON.parse($data);
      let html = document.createElement("div");
      html.innerHTML = $data.list_element;
      let listfiles = html.querySelector("#listfiles");
      if (listfiles.childNodes.length === 0) {
        let emptyFolderMsg = `
              <div class="empty-folder-warning">
                  ${gettext("This folder is empty")}
              </div>
              `;
        $data["emptyfoldermsg"] = emptyFolderMsg;
      }
      return $data;
    };
    let error_func = function ($xhr) {};
    send_form_data(
      e.target.dataset.target,
      {},
      "show_folder_files",
      "get",
      success_func,
      error_func
    );
  });
  /*********** OPEN/CLOSE FOLDER MENU ************/
  document.addEventListener("click", (e) => {
    if (
      !e.target.classList.contains("folder") &&
      e.target.id != "close-folder-icon"
    )
      return;
    document.querySelector("#podfile #dirs").classList.remove("open");
  });

  document.querySelectorAll("#open-folder-icon > *").forEach((el) => {
    el.style = "pointer-events: none; cursor : pointer;";
  });
  if (document.querySelector("#open-folder-icon")) {
    document.getElementById("open-folder-icon").style.cursor = "pointer";
  }

  document.addEventListener("click", (e) => {
    if (
      e.target.id != "open-folder-icon" &&
      !e.target.matches("open-folder-icon i")
    )
      return;

    //unable click on span or i
    document.querySelectorAll(".folder_name").forEach((e) => {
      e.style = "pointer-events: none; ";
    });

    e.preventDefault();
    document.querySelector("#podfile #dirs").classList.add("open");
  });

  document.addEventListener("change", (e) => {
    if (e.target.id != "ufile") return;
    document.getElementById("formuploadfile").querySelector("button").click();
  });

  /****** CHANGE FILE ********/
  document.addEventListener("submit", (e) => {
    if (
      e.target.id != "formchangeimage" &&
      e.target.id != "formchangefile" &&
      e.target.id != "formuploadfile"
    )
      return;
    e.preventDefault();
    //alert('FORM');
    e.target.style.display = "none";
    document.querySelectorAll(".loadingformfiles").forEach((el) => {
      el.style.display = "block";
    });
    document.getElementById("listfiles").style.display = "none";

    var data_form = new FormData(e.target);

    var url = e.target.getAttribute("action");

    fetch(url, {
      method: "POST",
      body: data_form,
      processData: false,
      contentType: false,
    })
      .then((response) => response.json())
      .then((data) => {
        document.querySelectorAll(".loadingformfiles").forEach((el) => {
          el.style.display = "none";
        });
        document.getElementById("listfiles").style.display = "block";
        e.target.style.display = "block";
        show_folder_files(data);
      })

      .catch((error) => {
        e.target.style.display = "block";
        document.querySelectorAll(".loadingformfiles").forEach((el) => {
          el.style.display = "none";
        });
        document.getElementById("listfiles").style.display = "block";
        var data = error.status + " " + error.statusText;

        showalert(
          gettext("Error during exchange") +
            "(" +
            data +
            ")<br/>" +
            gettext("No data could be stored."),
          "alert-danger"
        );
      });
  });
  /****** CHANGE FILE ********/
  document.addEventListener("hide.bs.modal", (event) => {
    if (event.target.id != "folderModalCenter") return;
    event.stopPropagation();
  });

  document.addEventListener("show.bs.modal", (event) => {
    //event.preventDefault();

    if (event.target.id != "folderModalCenter") return;

    event.stopPropagation();

    let button = event.relatedTarget; // Button that triggered the modal
    let modal = event.target;
    modal.querySelectorAll("form").forEach((e) => {
      e.style.display = "none";
    });

    let folder_id = button.dataset.folderid;
    let filetype = button.dataset.filetype;

    switch (filetype) {
      case "CustomImageModel":
        document.getElementById("folderModalCenterTitle").innerHTML =
          gettext("Change") + " " + button.dataset.filename;
        modal.querySelectorAll(".modal-body input#id_folder").forEach((e) => {
          e.value = folder_id;
        });
        modal.querySelectorAll(".modal-body input#id_image").forEach((e) => {
          e.value = button.dataset.fileid;
        });
        modal.querySelectorAll(".modal-body input#file_type").forEach((e) => {
          e.value = button.dataset.filetype;
        });
        document.getElementById("formchangeimage").style.display = "block";
        break;
      case "CustomFileModel":
        document.getElementById("folderModalCenterTitle").innerHTML =
          gettext("Change") + " " + button.dataset.filename;
        modal.querySelectorAll(".modal-body input#id_folder").value = folder_id;
        modal.querySelectorAll(".modal-body input#file_id").value =
          button.dataset.fileid;
        modal.querySelectorAll(".modal-body input#file_type").value =
          button.dataset.filetype;
        document.getElementById("formchangefile").style.display = "block";
        break;
      default: // Extract info from data-* attributes
        document.getElementById("folderFormName").style.display = "block";
        document.getElementById("folderModalCenterTitle").innerHTML = gettext(
          "Enter new name of folder"
        );
        4;
        let oldname = button.dataset.oldname;
        // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
        // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
        let folder_input = modal.querySelector(
          ".modal-body input#folderInputName"
        );
        folder_input.value = oldname;
        let focus = new Event("focus");
        folder_input.dispatchEvent(focus);
        modal.querySelector(".modal-body input#formfolderid").value = folder_id;
        break;
    }
  });

  function user_li(text, elt, type) {
    let cls =
      type.toLowerCase() === "add"
        ? "btn-success btn-add"
        : "btn-danger btn-remove";
    return `<li class="list-group-item"><span class="username">${
      elt.first_name
    } ${elt.last_name} ${
      !HIDE_USERNAME ? "(" + elt.username + ")" : ""
    }</span><a href="#" type="button" data-userid="${
      elt.id
    }" class="btn btn-share ${cls}">${text}</a></li>`;
  }

  function reloadRemoveBtn() {
    let remove = gettext("Remove");
    document.getElementById("shared-people").innerHTML = "";
    url =
      "/podfile/ajax_calls/folder_shared_with?foldid=" +
      document.getElementById("formuserid").value;
    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;

    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.length > 0) {
          data.forEach((elt) => {
            document
              .getElementById("shared-people")
              .append(user_li(remove, elt, "remove"));
          });
        }
      })
      .catch((error) => {
        showalert(gettext("Server error") + "<br/>" + error, "alert-danger");
      });
  }

  function reloadAddBtn(searchTerm) {
    if (!document.getElementById("formuserid")) return;
    let folderid = Number.parseInt(document.getElementById("formuserid").value);
    let add = gettext("Add");
    let url =
      "/podfile/ajax_calls/search_share_user?term=" +
      searchTerm +
      "&foldid=" +
      folderid;
    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;
    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
      cache: "no-cache",
    })
      .then((response) => response.json())
      .then((data) => {
        document.getElementById("user-search").innerHTML = "";
        data.forEach((elt) => {
          document
            .getElementById("user-search")
            .append(user_li(add, elt, "add"));
        });
        fadeIn(document.getElementById("user-search"));
      })
      .catch((error) => {
        showalert(gettext("Server error") + "<br/>" + error, "alert-danger");
      });
  }

  //$(document).on('click', '#currentfoldershare', function(e){
  document.addEventListener("hide.bs.modal", (event) => {
    if (event.target.id != "shareModalCenter") return;
    event.stopPropagation();
  });
  document.addEventListener("show.bs.modal", (event) => {
    if (event.target.id != "shareModalCenter") return;
    event.stopPropagation();
    document.getElementById("user-search").style.display = "none";
    document.getElementById("shared-people").textContent = "";
    let button = event.relatedTarget;
    var folder_id = button.dataset.folderid;

    let modal = document.querySelector(button.dataset.bsTarget);
    modal.querySelector("#formuserid").value = folder_id;
    reloadRemoveBtn();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-remove")) return;
    url =
      "/podfile/ajax_calls/remove_shared_user?foldid=" +
      document.getElementById("formuserid").value +
      "&userid=" +
      e.target.dataset.userid;
    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;
    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
      cache: "no-cache",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status == "ok") {
          reloadRemoveBtn();
        } else {
          showalert(
            gettext("Server error") + "<br/>" + data.message,
            "alert-danger"
          );
        }
      })
      .catch((error) => {
        showalert(gettext("Server error") + "<br/>" + error, "alert-danger");
      });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-add")) return;
    url =
      "/podfile/ajax_calls/add_shared_user?foldid=" +
      document.getElementById("formuserid").value +
      "&userid=" +
      e.target.dataset.userid;
    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;

    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
      cache: "no-cache",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status == "ok") {
          reloadAddBtn(document.getElementById("userInputName").value);
          reloadRemoveBtn();
        } else {
          showalert(
            gettext("Server error") + "<br/>" + data.message,
            "alert-danger"
          );
        }
      })
      .catch((error) => {
        showalert(gettext("Server error") + "<br/>" + error, "alert-danger");
      });
  });

  document.addEventListener("click", (e) => {
    if (e.target.id != "modalSave") return;
    document.querySelectorAll("#folderModalCenter form").forEach((form) => {
      if (form.style.display == "none") return;
      let button = document.createElement("button");
      button.type = "submit";
      button.style.display = "none";
      form.append(button);
      button.click();
    });
  });

  document.addEventListener("click", (e) => {
    if (e.target.id != "currentfolderdelete") return;
    var deleteConfirm = confirm(
      gettext("Are you sure you want to delete this folder?")
    );
    if (deleteConfirm) {
      let id = e.target.dataset.folderid;
      let csrfmiddlewaretoken = e.target.querySelector(
        'input[name="csrfmiddlewaretoken"]'
      ).value;
      send_form_data(
        deletefolder_url,
        { id: id, csrfmiddlewaretoken: csrfmiddlewaretoken },
        "reloadFolder"
      );
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("btn-delete-file")) return;
    var deleteConfirm = confirm(
      gettext("Are you sure you want to delete this file?")
    );
    if (deleteConfirm) {
      let id = e.target.dataset.fileid;
      let classname = e.target.dataset.filetype;
      let csrfmiddlewaretoken = e.target.querySelector("input").value;
      send_form_data(
        deletefile_url,
        {
          id: id,
          classname: classname,
          csrfmiddlewaretoken: csrfmiddlewaretoken,
        },
        "show_folder_files"
      );
    }
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id != "folderFormName") return;
    e.preventDefault();
    let form = e.target;
    let data_form = new FormData(form);
    send_form_data(form.getAttribute("action"), data_form, "reloadFolder");
  });

  var lock = false;
  document.addEventListener("input", (e) => {
    if (e.target.id != "folder-search") return;
    var text = e.target.value.toLowerCase();
    if (lock && text.length > 0) {
      return;
    }
    if (text.length > 2 || text.length == 0) {
      lock = true;
      document.getElementById("list_folders_sub").innerHTML = "";
      let type = document.getElementById("list_folders_sub").dataset.type;
      let currentFolder = getCurrentSessionFolder();
      let url = "/podfile/ajax_calls/user_folders?search=" + text;
      let token = document.querySelector(
        'input[name="csrfmiddlewaretoken"]'
      ).value;
      fetch(url, {
        method: "GET",
        headers: {
          "X-CSRFToken": token,
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        cache: "no-cache",
      })
        .then((response) => response.json())
        .then((data) => {
          let nextPage = data.next_page;

          data.folders.forEach((elt) => {
            let string_html =
              '<div class="folder_container">' +
              createFolder(
                elt.id,
                elt.name,
                currentFolder == elt.name,
                type,
                elt.owner
              ) +
              "</div>";
            let parsedHTML = new DOMParser().parseFromString(
              string_html,
              "text/html"
            ).body.firstChild;
            document.getElementById("list_folders_sub").appendChild(parsedHTML);
          });
          if (nextPage != -1) {
            document
              .getElementById("list_folders_sub")
              .append(
                seeMoreElement(
                  nextPage,
                  data.current_page + 1,
                  data.total_pages,
                  text
                )
              );
          }
          lock = false;
        })
        .catch((error) => {
          showalert(gettext("Server error") + "<br/>" + error, "alert-danger");
        });
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id != "userInputName") return;

    if (e.target.value && e.target.value.length > 2) {
      var searchTerm = e.target.value;
      reloadAddBtn(searchTerm);
    } else {
      let user_search = document.getElementById("user_search");
      if (user_search) {
        user_search.innerHTML = "";
        fadeOut(user_search, 300);
        setTimeout(() => {
          user_search.hide();
        }, 300);
      }
    }
  });

  function reloadFolder(data) {
    if (!isJson(data)) data = JSON.parse(data);
    if (data.list_element) {
      var folder_id = data.folder_id;

      if (data.new_folder == true) {
        let type = document.getElementById("list_folders_sub").dataset.type;

        let string_html =
          '<div class="folder_container">' +
          createFolder(
            data.folder_id,
            data.folder_name,
            true,
            type,
            undefined
          ) +
          "</div>";
        let parsedHTML = new DOMParser().parseFromString(
          string_html,
          "text/html"
        ).body.firstChild;

        document
          .getElementById("list_folders_sub")
          .insertBefore(
            parsedHTML,
            document.getElementById("list_folders_sub").firstChild
          );
      }

      if (data.folder_name) {
        document.querySelector("#folder-name-" + folder_id).textContent =
          "  " + data.folder_name;
      }

      if (data.deleted) {
        document.querySelector("#folder_" + data.deleted_id).remove();
      }
      send_form_data(
        "/podfile/get_folder_files/" + folder_id,
        {},
        "show_folder_files",
        "get"
      );
      //dismiss modal
      let center_mod = document.getElementById("folderModalCenter");
      let center_modal = bootstrap.Modal.getOrCreateInstance(center_mod);
      center_modal.hide();
      center_mod.querySelector(".modal-body input#folderInputName").value = "";
      center_mod.querySelector(".modal-body input#formfolderid").value = "";
    } else {
      showalert(
        gettext("You are no longer authenticated. Please log in again."),
        "alert-danger"
      );
    }
  }

  function show_folder_files(data) {
    if (!isJson(data)) data = JSON.parse(data);

    document.getElementById("files").classList.remove("loading");
    if (data.list_element) {
      document.getElementById("files").innerHTML = data.list_element;
      if ("emptyfoldermsg" in data) {
        document.querySelector("#files #listfiles").innerHTML =
          data.emptyfoldermsg;
      }
      document.querySelectorAll(".list_folders a").forEach((elt) => {
        elt.classList.remove("font-weight-bold");
      });
      document.querySelectorAll("img.directory-image").forEach((elt) => {
        elt.src = static_url + "podfile/images/folder.png";
      });
      document.querySelectorAll("img.file-image").forEach((elt) => {
        elt.src = static_url + "podfile/images/home_folders.png";
      });
      let folder_id = document.getElementById("folder_" + data.folder_id);
      if (folder_id) {
        document
          .querySelector("#folder_" + data.folder_id)
          .classList.add("font-weight-bold");
      }

      let folder = document.querySelector("#folder_" + data.folder_id + " img");
      if (folder) folder.src = static_url + "podfile/images/opened_folder.png";

      //dismiss modal
      let center_modal = document.getElementById("folderModalCenter");
      let center_modal_instance =
        bootstrap.Modal.getOrCreateInstance(center_modal);
      center_modal_instance.hide();
      center_modal.querySelector(".modal-body input#folderInputName").value =
        "";
      center_modal.querySelector(".modal-body input#formfolderid").value = "";

      if (data.upload_errors && data.upload_errors != "") {
        const str = data.upload_errors.split("\n").join("<br/>");
        showalert(
          gettext("Error during exchange") + "<br/>" + str,
          "alert-danger"
        );
      }
    } else {
      if (data.errors) {
        showalert(data.errors + "<br/>" + data.form_error, "alert-danger");
      } else {
        showalert(
          gettext("You are no longer authenticated. Please log in again."),
          "alert-danger"
        );
      }
    }
  }

  function append_folder_html_in_modal(data) {
    console.log("appended folder html in modal");
    document.querySelector("#modal-folder_" + id_input).innerHTML = data;
  }

  function getCurrentSessionFolder() {
    let folder = "home";
    let url = "/podfile/ajax_calls/current_session_folder/";

    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;
    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        folder = data.folder;
      })
      .catch((error) => {});
    return folder;
  }

  var folder_open_icon = `<i class="folder-open bi bi-folder2-open" id="folder-open-icon"></i>`;
  var folder_icon = `<i class="folder-close bi bi-folder2" id="folder-icon"></i>`;

  function createFolder(foldid, foldname, isCurrent, type, owner = undefined) {
    let construct = "";
    construct +=
      '<a href="#" class="folder ' +
      (isCurrent ? "font-weight-bold folder-opened" : "") +
      ' " id="folder_' +
      foldid +
      '" data-foldname="' +
      foldname +
      '" data-id="' +
      foldid +
      '" data-target="';
    let isType = type != "None" && type != undefined;
    construct +=
      "/podfile/get_folder_files/" +
      foldid +
      (isType ? "?type=" + type : "") +
      '">';
    if (owner != undefined) {
      foldname =
        '<span class="folder_name" id="folder-name-' +
        foldid +
        '">  ' +
        foldname +
        "</span> <span><b>(" +
        owner +
        ")</b></span>";
    } else {
      foldname =
        '<span class="folder_name" id="folder-name-' +
        foldid +
        '">  ' +
        foldname +
        "</span>";
    }
    construct += `${folder_open_icon} ${folder_icon} ${foldname}</a>`;
    return construct;
  }

  function initFolders() {
    let type = document.getElementById("list_folders_sub").dataset.type;
    let currentFolder = getCurrentSessionFolder();
    let url = "/podfile/ajax_calls/user_folders";
    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;
    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        let nextPage = data.next_page;
        data.folders.forEach((elt) => {
          let string_html =
            '<div class="folder_container">' +
            createFolder(
              elt.id,
              elt.name,
              currentFolder == elt.name,
              type,
              elt.owner
            ) +
            "</div>";
          let parsedHTML = new DOMParser().parseFromString(
            string_html,
            "text/html"
          ).body.firstChild;
          document.getElementById("list_folders_sub").appendChild(parsedHTML);
        });
        if (nextPage != -1) {
          document
            .getElementById("list_folders_sub")
            .append(
              seeMoreElement(nextPage, data.current_page + 1, data.total_pages)
            );
        }
      });
  }
  document.addEventListener("DOMContentLoaded", (e) => {
    if (typeof myFilesView !== "undefined") {
      initFolders();
    }
  });

  var seeMoreElement = function (nextPage, curr_page, tot_page, search = null) {
    search = search ? `&search=${search}` : "";
    let seeMore = gettext("See more");
    return `
       <div class="view-more-container">
           <a id="more" href="#" data-next="/podfile/ajax_calls/user_folders?page=${nextPage}${search}">
              <span class="see-more" id="see-more-icon">
                  <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="arrow-right" class="svg-inline--fa fa-arrow-right fa-w-14" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M190.5 66.9l22.2-22.2c9.4-9.4 24.6-9.4 33.9 0L441 239c9.4 9.4 9.4 24.6 0 33.9L246.6 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.2-22.2c-9.5-9.5-9.3-25 .4-34.3L311.4 296H24c-13.3 0-24-10.7-24-24v-32c0-13.3 10.7-24 24-24h287.4L190.9 101.2c-9.8-9.3-10-24.8-.4-34.3z"></path></svg>
              </span><span class="text">${seeMore} (${curr_page}/${tot_page})</span>
              <div class="loader lds-ellipsis"><div></div><div></div><div></div><div></div></div>
           </a>
       </div>
    `;
  };
  document.addEventListener("click", (e) => {
    if (!e.target.matches("#list_folders_sub .view-more-container a#more"))
      return;

    let parent_el = e.target.parentNode;
    parent_el.classList.add("loading");
    let next = e.target.dataset.next;
    let search = e.target.dataset.search;
    let currentFolder = getCurrentSessionFolder();
    let type = document.getElementById("list_folders_sub").dataset.type;
    let url = next;
    let token = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ).value;

    fetch(url, {
      method: "GET",
      headers: {
        "X-CSRFToken": token,
        Authorization: "Bearer " + token,
      },
      cache: "no-cache",
    })
      .then((response) => response.json())
      .then((data) => {
        parent_el.remove();
        let nextPage = data.next_page;
        data.folders.forEach((elt) => {
          let string_html =
            '<div class="folder_container">' +
            createFolder(
              elt.id,
              elt.name,
              currentFolder == elt.name,
              type,
              elt.owner
            ) +
            "</div>";
          let parsedHTML = new DOMParser().parseFromString(
            string_html,
            "text/html"
          ).body.firstChild;
          document.getElementById("list_folders_sub").appendChild(parsedHTML);
        });
        if (nextPage != -1) {
          document
            .getElementById("list_folders_sub")
            .append(
              seeMoreElement(
                nextPage,
                response.current_page + 1,
                response.total_pages,
                search
              )
            );
        }
      });
  });

  document.addEventListener("show.bs.modal", (event) => {
    if (!event.target.matches(".podfilemodal")) return;
    event.stopPropagation();
    setTimeout(function () {
      //initFolders();
    }, 500);
  });
}

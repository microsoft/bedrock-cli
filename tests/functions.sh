print_array () {
    #usage: print_array "${my_array[@]}"
    arr=("$@")
    for i in "${arr[@]}";
    do
        : 
        echo "\t$i"
    done
}
validate_directory () {    
    echo "Checking directory $1" 
    #Get first arg then shift over to get array arg
    actual_files=( $(find $1 -maxdepth 1 -type f) ); shift
    # actual_files=("$1"/*); shift
    local expected_files=( "$@" ) #"${2[@]}" #("azure-pipelines.yaml" "Dockerfile" )

    # Get the base filenames for comparison
    actual_base_files=()
    for i in "${actual_files[@]}"
    do
        : 
        echo "Current file: $i"
        currentFile=$(basename "$i")
        # echo "Current file: $currentFile"
        actual_base_files+=($currentFile)
    done

    if [ ${#actual_files[@]} -ne ${#expected_files[@]} ];then
        echo "File count mismatch";
        echo "Expected ${#expected_files[@]} files but there are ${#actual_files[@]} files"
        exit 1
    fi

    # Comparing arrarys
    difference_array=()
    for i in "${expected_files[@]}"; do
        skip=
        for j in "${actual_base_files[@]}"; do
            [[ $i == $j ]] && { skip=1; break; }
        done
        [[ -n $skip ]] || difference_array+=("$i")
    done
    #declare -p difference_array

    # echo "Size: ${#difference_array[@]}"
    if [ ${#difference_array[@]} -ne 0 ];then
        echo "Found unexpected files in directory..."
        print_array "${difference_array[@]}"
        exit 1
    fi
}

validate_service () {
    echo "Checking directory `$1`" 
    local files=( ".gitignore" "azure-pipelines.yaml" "Dockerfile" )
    for i in "${files[@]}"
    do
        : 
        currentFile="$1/$i"
        echo "Current file: $currentFile"
        if [ ! -f $currentFile ]; then
            echo "The file `$i` does not exist in directory `$1`"
            exit 1
        fi
    done
}

validate_mono_repo () {
    echo "Checking directory `$1`" 
    local files=( ".gitignore" "bedrock.yaml" "maintainers.yaml" )
    for i in "${files[@]}"
    do
        : 
        currentFile="$1/$i"
        echo "Current file: $currentFile"
        if [ ! -f $currentFile ]; then
            echo "The file `$i` does not exist in directory `$1`"
            exit 1
        fi
    done
    echo "Not implemented" && exit 1
}

validate_pipeline_creation () {
    #TODO
    echo "Not implemented" && exit 1
}

validate_pull_request () {
    #TODO
    echo "Not implemented" && exit 1
}

function getHostandPath () {
    # extract the protocol
    proto="$(echo $1 | grep :// | sed -e's,^\(.*://\).*,\1,g')"
    # remove the protocol
    url="$(echo ${1/$proto/})"
    # extract the user (if any)
    user="$(echo $url | grep @ | cut -d@ -f1)"
    # extract the host and port
    hostport="$(echo ${url/$user@/} | cut -d/ -f1)"
    # by request host without port    
    host="$(echo $hostport | sed -e 's,:.*,,g')"
    # by request - try to extract the port
    port="$(echo $hostport | sed -e 's,^.*:,:,g' -e 's,.*:\([0-9]*\).*,\1,g' -e 's,[^0-9],,g')"
    # extract the path (if any)
    path="$(echo $url | grep / | cut -d/ -f2-)"
    
    echo "$host/$path"
}
